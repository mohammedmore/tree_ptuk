import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { authenticatePTUK } from "../src/services/authService.js";
import { scrapePTUKSchedules } from "../src/services/ptukScraper.js";

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireSupabaseConfiguration() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
    );
  }
}

function chunk(items, size = BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function isTransientError(error) {
  const status = Number(error?.status);
  return (
    !Number.isFinite(status) ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Run idempotent Supabase operations with a bounded exponential backoff.
 *
 * @param {string} label
 * @param {() => Promise<{ data?: unknown, error?: object | null }>} operation
 * @returns {Promise<unknown>}
 */
async function runSupabaseOperation(label, operation) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await operation();
      if (result.error) {
        const error = new Error(result.error.message || `${label} failed.`);
        error.status = result.error.status;
        error.code = result.error.code;
        throw error;
      }
      return result.data;
    } catch (error) {
      lastError = error;
      const hasRetriesLeft = attempt < MAX_RETRIES - 1;
      if (!hasRetriesLeft || !isTransientError(error)) {
        break;
      }
      await wait(500 * 2 ** attempt);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed: ${message}`, { cause: lastError });
}

function prepareSyncData(catalog) {
  const coursesData = catalog.map(({ code, name, type }) => ({
    code,
    name,
    type,
  }));
  const sectionsData = catalog.flatMap((course) =>
    course.sections.map((section) => ({
      course_code: course.code,
      sec_number: section.sec,
      instructor: section.instructor,
      room: section.room,
      building: section.building,
      status: section.status,
    })),
  );
  const sectionScheduleData = catalog.flatMap((course) =>
    course.sections.map((section) => ({
      course_code: course.code,
      sec_number: section.sec,
      blocks: section.blocks.flatMap((block) =>
        block.days.map((day) => ({
          day,
          start_hour: block.start,
          end_hour: block.end,
          raw_time: block.rawTime,
        })),
      ),
    })),
  );

  return { coursesData, sectionsData, sectionScheduleData };
}

async function upsertBatches(supabase, table, records, onConflict) {
  for (const batch of chunk(records)) {
    await runSupabaseOperation(`Upserting ${table}`, () =>
      supabase.from(table).upsert(batch, { onConflict }),
    );
  }
}

async function replaceSectionBlocks(
  supabase,
  sectionRows,
  sectionBlocksBySection,
) {
  const sectionIds = sectionRows.map(({ id }) => id);
  if (sectionIds.length === 0) return 0;

  for (const idBatch of chunk(sectionIds)) {
    await runSupabaseOperation("Deleting existing section blocks", () =>
      supabase.from("section_blocks").delete().in("section_id", idBatch),
    );
  }

  const sectionIdsByKey = new Map(
    sectionRows.map((section) => [
      `${section.course_code}\u0000${section.sec_number}`,
      section.id,
    ]),
  );
  const sectionBlocksData = sectionBlocksBySection.flatMap((section) => {
    const sectionId = sectionIdsByKey.get(
      `${section.course_code}\u0000${section.sec_number}`,
    );
    if (!sectionId) {
      throw new Error(
        `Supabase did not return an id for section ${section.sec_number} of ${section.course_code}.`,
      );
    }
    return section.blocks.map((block) => ({
      section_id: sectionId,
      ...block,
    }));
  });

  for (const batch of chunk(sectionBlocksData)) {
    await runSupabaseOperation("Upserting section blocks", () =>
      supabase.from("section_blocks").upsert(batch),
    );
  }

  return sectionBlocksData.length;
}

export async function runPTUKSync() {
  requireSupabaseConfiguration();
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Authenticating to PTUK Edugate...");
  const { cookie, viewState } = await authenticatePTUK();
  const catalog = await scrapePTUKSchedules(cookie, viewState);

  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error("The PTUK scraper returned no courses; refusing to sync.");
  }

  const { coursesData, sectionsData, sectionScheduleData } =
    prepareSyncData(catalog);
  if (sectionsData.length === 0) {
    throw new Error("The PTUK scraper returned no sections; refusing to sync.");
  }

  console.log(
    `Preparing ${coursesData.length} courses and ${sectionsData.length} sections...`,
  );
  await upsertBatches(supabase, "courses", coursesData, "code");

  const sectionRowsByBatch = await Promise.all(
    chunk(sectionsData).map((batch) =>
      runSupabaseOperation("Upserting sections", () =>
        supabase
          .from("sections")
          .upsert(batch, { onConflict: "course_code,sec_number" })
          .select("id,course_code,sec_number"),
      ),
    ),
  );
  if (sectionRowsByBatch.some((data) => !Array.isArray(data))) {
    throw new Error("Supabase did not return the upserted section records.");
  }
  const sectionRows = sectionRowsByBatch.flat();

  const sectionBlocksCount = await replaceSectionBlocks(
    supabase,
    sectionRows,
    sectionScheduleData,
  );

  console.log(
    `PTUK sync succeeded: ${coursesData.length} courses, ${sectionsData.length} sections, ${sectionBlocksCount} schedule blocks.`,
  );
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  try {
    await runPTUKSync();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`PTUK sync failed: ${message}`);
    process.exitCode = 1;
  }
}

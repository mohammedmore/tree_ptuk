import axios from "axios";
import * as cheerio from "cheerio";

const SCHEDULE_URL =
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/scheduleCourses/index.xhtml";
const PAGE_SIZE = 15;
const MAX_PAGES = 200;
const PAGE_REQUEST_DELAY_MS = 1_500;
const TIME_RANGE_PATTERN =
  /\[?\s*(\d{1,2}:\d{2})\s*[_\u2013\u2014-]\s*(\d{1,2}:\d{2})\s*\]?/g;
const DAY_NAMES = [
  ["الأحد", "الاحد", "أحد"],
  ["الاثنين", "الإثنين", "اثنين"],
  ["الثلاثاء", "ثلاثاء"],
  ["الأربعاء", "الاربعاء", "أربعاء"],
  ["الخميس", "خميس"],
  ["الجمعة", "جمعة"],
  ["السبت", "سبت"],
  ["Sunday"],
  ["Monday"],
  ["Tuesday"],
  ["Wednesday"],
  ["Thursday"],
  ["Friday"],
  ["Saturday"],
];

/**
 * @typedef {Object} ScheduleBlock
 * @property {string[]} days
 * @property {number} start
 * @property {number} end
 * @property {string} rawTime
 */

/**
 * @typedef {Object} CourseSection
 * @property {string} sec
 * @property {string} room
 * @property {string} status
 * @property {string} instructor
 * @property {string} building
 * @property {ScheduleBlock[]} blocks
 */

/**
 * @typedef {Object} Course
 * @property {string} code
 * @property {string} name
 * @property {string} type
 * @property {CourseSection[]} sections
 */

/**
 * Decode XML entities in an update payload that is not wrapped in CDATA.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeXmlEntities(value) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, code) => {
      if (code[0] === "#") {
        const radix = code[1].toLowerCase() === "x" ? 16 : 10;
        const digits = radix === 16 ? code.slice(2) : code.slice(1);
        const character = Number.parseInt(digits, radix);
        return Number.isFinite(character)
          ? String.fromCodePoint(character)
          : entity;
      }

      return (
        {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
        }[code.toLowerCase()] ?? entity
      );
    },
  );
}

/**
 * Extract a JSF partial-response update body by its update id.
 *
 * @param {string} xml
 * @param {string} id
 * @returns {string | null}
 */
function getUpdateContent(xml, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const updatePattern = new RegExp(
    `<update\\b(?=[^>]*\\bid=(["'])${escapedId}\\1)[^>]*>([\\s\\S]*?)<\\/update>`,
    "i",
  );
  const match = updatePattern.exec(xml);

  if (!match) return null;

  const content = match[2].trim();
  const cdataMatch = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(content);
  return cdataMatch ? cdataMatch[1] : decodeXmlEntities(content);
}

/**
 * Extract the ViewState value from a PrimeFaces partial response.
 *
 * @param {string} xmlString
 * @returns {string | null}
 */
function extractViewState(xmlString) {
  const match = xmlString.match(
    /<update id="[^"]*ViewState[^"]*"><!\[CDATA\[(.*?)\]\]><\/update>/i,
  );

  return match?.[1] ?? null;
}

/**
 * Convert an HH:MM time to decimal hours.
 *
 * @param {string} value
 * @returns {number | null}
 */
function parseHour(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0))
    return null;

  return hours + minutes / 60;
}

/**
 * Return normalized day labels present in a text segment.
 *
 * @param {string} value
 * @returns {string[]}
 */
function parseDays(value) {
  const normalized = value.replace(/[إأآ]/g, "ا").toLocaleLowerCase();
  const matched = DAY_NAMES.flatMap((aliases) => {
    const hasDay = aliases.some((alias) =>
      normalized.includes(alias.replace(/[إأآ]/g, "ا").toLocaleLowerCase()),
    );

    return hasDay ? [aliases[0]] : [];
  });

  return [...new Set(matched)];
}

/**
 * Parse one or more time ranges from the schedule cell, retaining line boundaries.
 *
 * @param {string} value
 * @returns {ScheduleBlock[]}
 */
function parseScheduleBlocks(value) {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٫：]/g, (separator) => (separator === "٫" ? "." : ":"))
    .replace(/\u00a0/g, " ");
  const lines = normalized
    .split(/[\r\n|]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.flatMap((line) => {
    const matches = [...line.matchAll(TIME_RANGE_PATTERN)];
    if (matches.length === 0) return [];

    const days = parseDays(line);
    const rawTime = line.trim();

    return matches.flatMap((match) => {
      const start = parseHour(match[1]);
      const end = parseHour(match[2]);
      if (start === null || end === null || end <= start) return [];

      return [{ days, start, end, rawTime }];
    });
  });
}

/**
 * Read a cell's visible text while preserving common HTML line breaks.
 *
 * @param {import("cheerio").Cheerio<import("domhandler").Element>} cell
 * @returns {string}
 */
function getCellText(cell) {
  const html = (cell.html() ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|li|p|tr)>/gi, "\n");

  return cheerio
    .load(html)
    .root()
    .text()
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Extract data rows from either a complete table or a bare PrimeFaces row fragment.
 *
 * @param {string} xmlString
 * @returns {string[][]}
 */
function extractRowsFromXml(xmlString) {
  const $ = cheerio.load(`<table>${xmlString}</table>`);
  const rows = [];

  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => getCellText($(td)))
      .get();
    if (cells.length < 8) return;

    rows.push(cells);
  });

  return rows;
}

/**
 * Parse extracted table rows into grouped course records.
 *
 * @param {string[][]} rows
 * @param {Map<string, Course>} coursesByCode
 * @returns {number} Number of accepted data rows.
 */
function addTableRows(rows, coursesByCode) {
  let acceptedRows = 0;

  for (const values of rows) {
    if (values.some((value) => value.includes("مختلط"))) continue;

    const [
      ,
      code,
      name,
      type,
      rawSchedule = "",
      room = "",
      sectionNumber,
      status = "",
      instructor = "",
      building = "",
    ] = values;
    if (!code || !name || !sectionNumber) continue;

    let course = coursesByCode.get(code);
    if (!course) {
      course = { code, name, type, sections: [] };
      coursesByCode.set(code, course);
    }

    let section = course.sections.find((item) => item.sec === sectionNumber);
    if (!section) {
      section = {
        sec: sectionNumber,
        room,
        status,
        instructor,
        building,
        blocks: [],
      };
      course.sections.push(section);
    } else {
      section.room = room || section.room;
      section.status = status || section.status;
      section.instructor = instructor || section.instructor;
      section.building = building || section.building;
    }

    section.blocks = [...section.blocks, ...parseScheduleBlocks(rawSchedule)];
    acceptedRows += 1;
  }

  return acceptedRows;
}

/**
 * Fetch all PTUK course sections by following the JSF ViewState returned by each page.
 *
 * @param {string} cookieHeader
 * @param {string} initialViewState
 * @returns {Promise<Course[]>}
 */
async function scrapePTUKSchedules(cookieHeader, initialViewState) {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    throw new TypeError("cookieHeader must be a non-empty string.");
  }
  if (typeof initialViewState !== "string" || !initialViewState.trim()) {
    throw new TypeError("initialViewState must be a non-empty string.");
  }

  const coursesByCode = new Map();
  let currentViewState = initialViewState.trim();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, PAGE_REQUEST_DELAY_MS),
      );
    }

    const firstOffset = page * PAGE_SIZE;
    const params = new URLSearchParams({
      "javax.faces.partial.ajax": "true",
      "javax.faces.source": "contents:scheduleDtl",
      "javax.faces.partial.execute":
        page === 0 ? "@all" : "contents:scheduleDtl",
      "javax.faces.partial.render": "contents:scheduleDtl contents:msgs",
      "javax.faces.behavior.event": "page",
      "javax.faces.partial.event": "page",
      "javax.faces.ViewState": currentViewState,
      "contents:j_idt117_input": "1",
    });
    params.append("contents:scheduleDtl_pagination", "true");
    params.append("contents:scheduleDtl_first", String(firstOffset));
    params.append("contents:scheduleDtl_rows", String(PAGE_SIZE));
    params.append("contents:scheduleDtl_rppDD", String(PAGE_SIZE));

    if (page > 0) {
      params.append("contents", "contents");
      params.append("contents:scheduleDtl_skipChildren", "true");
      params.append("contents:scheduleDtl_encodeFeature", "true");
    }

    let response;
    try {
      response = await axios.post(SCHEDULE_URL, params.toString(), {
        timeout: 30000,
        headers: {
          Accept: "application/xml, text/xml, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: cookieHeader,
          "Faces-Request": "partial/ajax",
          Origin: "https://edugate.ptuk.edu.ps",
          Referer: SCHEDULE_URL,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `PTUK schedule request for page ${page + 1} failed: ${message}`,
        {
          cause: error,
        },
      );
    }
    const xml = String(response.data);
    const sessionExpiredMessage =
      "Session expired. Please provide a fresh PTUK cookie.";
    const isHtmlDocument = /^[\uFEFF\s]*<!DOCTYPE\s+html\b/i.test(xml);
    const hasLoginPageMarkers =
      /(?:login|sign[ -]?in|تسجيل الدخول|اسم المستخدم|كلمة المرور)/i.test(
        xml,
      ) &&
      (/<(?:html|form|input|body)\b/i.test(xml) ||
        /login\.(?:xhtml|jsf|html?)/i.test(xml));

    if (isHtmlDocument || hasLoginPageMarkers) {
      throw new Error(sessionExpiredMessage);
    }

    const nextViewState = extractViewState(xml);
    if (nextViewState?.trim()) currentViewState = nextViewState.trim();

    const tableHtml = getUpdateContent(xml, "contents:scheduleDtl");
    if (tableHtml === null) {
      console.log(`PTUK page ${page + 1}: extracted 0 valid rows.`);
      break;
    }

    const rows = extractRowsFromXml(tableHtml);
    const extractedRows = addTableRows(rows, coursesByCode);
    const allSections = [...coursesByCode.values()].flatMap(
      (course) => course.sections,
    );
    console.log(
      `📄 جلب الصفحة ${page + 1}: تم استخراج ${rows.length} شعبة (الإجمالي حتى الآن: ${allSections.length})`,
    );
    if (extractedRows === 0) break;
  }

  return [...coursesByCode.values()];
}

export { scrapePTUKSchedules };
export default scrapePTUKSchedules;

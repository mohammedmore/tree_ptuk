const COURSES_API_URL = "http://localhost:3001/api/courses";

let coursesCache;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value, fieldName) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Invalid course response: ${fieldName} is missing.`);
  }
  const text = String(value).trim();
  if (!text) {
    throw new Error(`Invalid course response: ${fieldName} is empty.`);
  }
  return text;
}

function parseBlock(block) {
  if (!isRecord(block) || !Array.isArray(block.days)) {
    throw new Error("Invalid course response: a schedule block is malformed.");
  }
  const { start, end } = block;
  if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    typeof end !== "number" ||
    !Number.isFinite(end) ||
    end <= start ||
    !block.days.every((day) => typeof day === "string")
  ) {
    throw new Error(
      "Invalid course response: a schedule block has invalid times or days.",
    );
  }
  return { days: block.days, start, end };
}

function parseSection(section) {
  if (!isRecord(section) || !Array.isArray(section.blocks)) {
    throw new Error("Invalid course response: a section is malformed.");
  }
  return {
    sec: asText(
      section.sec ?? section.section ?? section.sectionNumber,
      "section number",
    ),
    instructor:
      typeof section.instructor === "string" ? section.instructor : undefined,
    room: typeof section.room === "string" ? section.room : undefined,
    status: typeof section.status === "string" ? section.status : undefined,
    building:
      typeof section.building === "string" ? section.building : undefined,
    blocks: section.blocks.map(parseBlock),
  };
}

function parseCourse(course) {
  if (!isRecord(course)) {
    throw new Error("Invalid course response: a course entry is malformed.");
  }
  const sections = course.sections;
  if (sections !== undefined && !Array.isArray(sections)) {
    throw new Error("Invalid course response: sections must be an array.");
  }
  return {
    id: asText(course.id ?? course.code ?? course.courseCode, "course code"),
    name: asText(
      course.name ?? course.courseName ?? course.title,
      "course name",
    ),
    type: typeof course.type === "string" ? course.type : undefined,
    category: typeof course.category === "string" ? course.category : undefined,
    color: typeof course.color === "string" ? course.color : undefined,
    sections: sections?.map(parseSection),
  };
}

function parseCourses(payload) {
  const entries = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.courses)
      ? payload.courses
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : null;

  if (!entries) {
    throw new Error("Invalid response from the course service.");
  }

  return entries.map(parseCourse);
}

function normalizeSearchText(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim();
}

async function loadCourses() {
  const response = await fetch(COURSES_API_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`تعذر تحميل المساقات (HTTP ${response.status}).`);
  }
  return parseCourses(await response.json());
}

/**
 * Gets all available courses and retains the resolved list in memory.
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export function fetchCourses() {
  if (!coursesCache) {
    coursesCache = loadCourses().catch((error) => {
      coursesCache = undefined;
      throw error;
    });
  }
  return coursesCache;
}

/**
 * Searches course names and codes, case-insensitively, including Arabic variants.
 * @param {string} query
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export async function searchCourses(query) {
  const courses = await fetchCourses();
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return courses.slice(0, 15);

  const matches = courses.flatMap((course) => {
    const normalizedId = normalizeSearchText(course.id);
    const normalizedName = normalizeSearchText(course.name);
    const ranks = [
      normalizedId === normalizedQuery ? 0 : Infinity,
      normalizedName === normalizedQuery ? 1 : Infinity,
      normalizedId.startsWith(normalizedQuery) ? 2 : Infinity,
      normalizedName.startsWith(normalizedQuery) ? 3 : Infinity,
      normalizedId.includes(normalizedQuery) ? 4 : Infinity,
      normalizedName.includes(normalizedQuery) ? 5 : Infinity,
    ];
    const rank = Math.min(...ranks);
    return Number.isFinite(rank) ? [{ course, rank }] : [];
  });

  return matches
    .sort((first, second) => first.rank - second.rank)
    .slice(0, 15)
    .map(({ course }) => course);
}

/**
 * Returns full course records, including all sections and meeting blocks, in
 * the order requested. Unknown and duplicate codes are ignored.
 * @param {string[]} codes
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export async function fetchCoursesByCodes(codes) {
  if (!Array.isArray(codes)) {
    throw new TypeError("Course codes must be provided as an array.");
  }

  const courses = await fetchCourses();
  const coursesByCode = new Map(courses.map((course) => [course.id, course]));
  const seen = new Set();
  return codes.flatMap((code) => {
    const normalizedCode = String(code).trim();
    const course = coursesByCode.get(normalizedCode);
    if (!course || seen.has(normalizedCode)) return [];
    seen.add(normalizedCode);
    return [course];
  });
}

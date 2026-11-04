import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const SQLITE_FILE = join(DATA_DIR, "planner.sqlite");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let sqliteInstance = null;

export function getSqliteDb() {
  if (sqliteInstance) return sqliteInstance;

  sqliteInstance = new Database(SQLITE_FILE);
  // High-performance WAL mode and normal synchronous for resilient concurrency
  sqliteInstance.pragma("journal_mode = WAL");
  sqliteInstance.pragma("synchronous = NORMAL");
  sqliteInstance.pragma("foreign_keys = ON");

  initTables(sqliteInstance);
  return sqliteInstance;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      course_code TEXT NOT NULL,
      sec_number TEXT NOT NULL,
      instructor TEXT,
      room TEXT,
      building TEXT,
      status TEXT,
      blocks_json TEXT NOT NULL,
      PRIMARY KEY (course_code, sec_number),
      FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS majors (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      cohort_year TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cohort_plans (
      key TEXT PRIMARY KEY,
      major_id TEXT NOT NULL,
      cohort_year TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      encrypted_payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_time TEXT,
      last_sync_status TEXT,
      total_courses INTEGER DEFAULT 0,
      total_sections INTEGER DEFAULT 0,
      total_blocks INTEGER DEFAULT 0,
      duration_seconds REAL DEFAULT 0,
      last_error_message TEXT,
      next_scheduled_sync TEXT,
      sync_interval_cron TEXT DEFAULT '*/30 * * * *'
    );

    CREATE TABLE IF NOT EXISTS academic_calendar (
      id TEXT PRIMARY KEY,
      academic_year TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_code);
    CREATE INDEX IF NOT EXISTS idx_sections_course_sec ON sections(course_code, sec_number);
    CREATE INDEX IF NOT EXISTS idx_sections_instructor ON sections(instructor);
    CREATE INDEX IF NOT EXISTS idx_sections_status ON sections(status);
    CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name);
    CREATE INDEX IF NOT EXISTS idx_majors_cohort ON majors(cohort_year);
    CREATE INDEX IF NOT EXISTS idx_cohort_plans_major_year ON cohort_plans(major_id, cohort_year);
  `);

  // Ensure default sync status row
  const row = db.prepare("SELECT id FROM sync_status WHERE id = 1").get();
  if (!row) {
    db.prepare(
      `
      INSERT INTO sync_status (id, last_sync_status, sync_interval_cron)
      VALUES (1, 'idle', '*/30 * * * *')
    `,
    ).run();
  }
}

/**
 * Upserts a batch of courses and their sections into SQLite within an atomic transaction.
 */
export function sqliteUpsertCoursesBatch(courses) {
  const db = getSqliteDb();
  const insertCourse = db.prepare(`
    INSERT INTO courses (code, name, type, data_json, updated_at)
    VALUES (@code, @name, @type, @data_json, @updated_at)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `);

  const deleteSections = db.prepare(
    `DELETE FROM sections WHERE course_code = ?`,
  );
  const insertSection = db.prepare(`
    INSERT INTO sections (course_code, sec_number, instructor, room, building, status, blocks_json)
    VALUES (@course_code, @sec_number, @instructor, @room, @building, @status, @blocks_json)
    ON CONFLICT(course_code, sec_number) DO UPDATE SET
      instructor = excluded.instructor,
      room = excluded.room,
      building = excluded.building,
      status = excluded.status,
      blocks_json = excluded.blocks_json
  `);

  const transaction = db.transaction((items) => {
    const now = new Date().toISOString();
    for (const c of items) {
      if (!c.code) continue;
      insertCourse.run({
        code: c.code,
        name: c.name || "",
        type: c.type || "",
        data_json: JSON.stringify(c),
        updated_at: now,
      });

      if (Array.isArray(c.sections) && c.sections.length > 0) {
        deleteSections.run(c.code);
        for (const s of c.sections) {
          insertSection.run({
            course_code: c.code,
            sec_number: String(s.sec || s.sec_number || ""),
            instructor: s.instructor || "",
            room: s.room || "",
            building: s.building || "",
            status: s.status || "",
            blocks_json: JSON.stringify(s.blocks || []),
          });
        }
      }
    }
  });

  transaction(courses);
}

/**
 * Reads all courses or filters by codes / search query directly using SQLite.
 */
export function sqliteGetCourses({
  codes,
  search,
  limit = 500,
  offset = 0,
} = {}) {
  const db = getSqliteDb();
  let query = "SELECT data_json FROM courses";
  const params = [];
  const whereClauses = [];

  if (codes && codes.length > 0) {
    const placeholders = codes.map(() => "?").join(",");
    whereClauses.push(`code IN (${placeholders})`);
    params.push(...codes.map((c) => String(c).trim()));
  }

  if (search && search.trim()) {
    whereClauses.push("(code LIKE ? OR name LIKE ?)");
    const pattern = `%${search.trim()}%`;
    params.push(pattern, pattern);
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query += " LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => JSON.parse(r.data_json));
}

/**
 * Upsert major into SQLite.
 */
export function sqliteUpsertMajor(major) {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO majors (id, code, name, cohort_year, data_json, updated_at)
    VALUES (@id, @code, @name, @cohort_year, @data_json, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      cohort_year = excluded.cohort_year,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `,
  ).run({
    id: String(major.id).toLowerCase().trim(),
    code: major.code || major.id,
    name: major.name || "",
    cohort_year: major.cohortYear || null,
    data_json: JSON.stringify(major),
    updated_at: now,
  });
}

/**
 * Get all valid majors from SQLite.
 */
export function sqliteGetMajors() {
  const db = getSqliteDb();
  const rows = db
    .prepare(
      `
    SELECT data_json FROM majors
    WHERE cohort_year IS NOT NULL AND id NOT IN ('cse', 'swe', 'cs', 'ee')
  `,
    )
    .all();
  return rows.map((r) => JSON.parse(r.data_json));
}

/**
 * Save encrypted student record to SQLite.
 */
export function sqliteSaveStudent(studentId, encryptedPayload) {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO students (student_id, encrypted_payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET
      encrypted_payload = excluded.encrypted_payload,
      updated_at = excluded.updated_at
  `,
  ).run(studentId, encryptedPayload, now);
}

/**
 * Get encrypted student record from SQLite.
 */
export function sqliteGetStudent(studentId) {
  const db = getSqliteDb();
  const row = db
    .prepare("SELECT encrypted_payload FROM students WHERE student_id = ?")
    .get(studentId);
  return row ? row.encrypted_payload : null;
}

/**
 * Optimizes SQLite database B-trees and queries (Item 140).
 */
export function optimizeSqliteDb() {
  try {
    const db = getSqliteDb();
    db.pragma("optimize");
    return true;
  } catch (err) {
    console.warn("⚠️ SQLite optimize error:", err.message);
    return false;
  }
}

/**
 * Saves Academic Calendar payload to SQLite.
 */
export function sqliteSaveAcademicCalendar(calendarData) {
  const db = getSqliteDb();
  const id = calendarData.academicYear || "current";
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO academic_calendar (id, academic_year, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      academic_year = excluded.academic_year,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `,
  ).run(
    id,
    calendarData.academicYear || "2026/2027",
    JSON.stringify(calendarData),
    now,
  );
}

/**
 * Retrieves the latest Academic Calendar payload from SQLite.
 */
export function sqliteGetAcademicCalendar() {
  const db = getSqliteDb();
  const row = db
    .prepare(
      "SELECT data_json FROM academic_calendar ORDER BY updated_at DESC LIMIT 1",
    )
    .get();
  return row ? JSON.parse(row.data_json) : null;
}

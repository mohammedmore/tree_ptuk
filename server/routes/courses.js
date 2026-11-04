import express from "express";
import { getCourses, getCourseByCode, getSyncStatus } from "../db.js";

const router = express.Router();

/**
 * GET /api/courses
 * Optional queries:
 * - codes: comma-separated course codes (e.g. 15200099,12140101)
 * - search: search term in code or name
 * - limit: number of results (default: 500)
 * - offset: pagination offset
 */
router.get("/", async (req, res) => {
  try {
    const { codes, search, limit, offset, compact, fields } = req.query;

    // ─── Input Validation ───────────────────────────────────────────
    // Limit search query length to prevent abuse
    if (search && typeof search === "string" && search.length > 200) {
      return res.status(400).json({ error: "استعلام بحث طويل جداً." });
    }

    const codeList = codes
      ? String(codes)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 50) // Cap max codes per request
      : undefined;

    const parsedLimit = limit
      ? Math.min(1000, Math.max(1, parseInt(String(limit), 10)))
      : 500;
    const parsedOffset = offset ? Math.max(0, parseInt(String(offset), 10)) : 0;
    const fieldList = fields
      ? String(fields)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined;

    let data = await getCourses({
      codes: codeList,
      search: search ? String(search) : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      fields: fieldList,
    });

    // Point 28: Compact payload minification for low-bandwidth mobile clients
    if (compact === "true" || compact === "1") {
      data = data.map((c) => ({
        code: c.code,
        name: c.name,
        type: c.type,
        secCount: Array.isArray(c.sections) ? c.sections.length : 0,
        sections: (c.sections || []).map((s) => ({
          sec: s.sec,
          ins: s.instructor,
          rm: s.room,
          bld: s.building,
          st: s.status,
          b: (s.blocks || []).map((b) => ({
            d: b.days,
            s: b.start,
            e: b.end,
            t: b.rawTime,
          })),
        })),
      }));
    }

    const syncStatus = getSyncStatus();

    res.set("X-Last-Sync-Time", syncStatus.lastSyncTime || "");
    res.set("X-Total-Courses", String(data.length));

    return res.json(data);
  } catch (err) {
    console.error("Courses route error:", err);
    return res.status(500).json({
      error: "فشل في استعلام المواد من قاعدة البيانات.",
    });
  }
});

/**
 * GET /api/courses/:code
 */
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code;

    // ─── Input Validation ───────────────────────────────────────────
    if (!code || typeof code !== "string" || code.length > 20) {
      return res.status(400).json({ error: "رمز المساق غير صالح." });
    }

    const course = await getCourseByCode(code);
    if (!course) {
      return res.status(404).json({ error: "المساق غير موجود." });
    }
    return res.json(course);
  } catch (err) {
    console.error("Course by code error:", err);
    return res.status(500).json({ error: "فشل في جلب بيانات المساق." });
  }
});

export default router;

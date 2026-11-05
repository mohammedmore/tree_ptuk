import express from "express";
import { getCourses, getCourseByCode, getSyncStatus } from "../db.js";
import {
  validateQuery,
  validateParams,
  coursesQuerySchema,
  courseCodeParamSchema,
} from "../validators.js";

const router = express.Router();

/**
 * GET /api/courses
 * Optional queries:
 * - codes: comma-separated course codes (e.g. 15200099,12140101)
 * - search: search term in code or name
 * - limit: number of results (default: 500)
 * - offset: pagination offset
 */
router.get("/", validateQuery(coursesQuerySchema), async (req, res) => {
  try {
    const { codes, search, limit, offset, compact, fields } = req.query;

    const codeList = codes
      ? String(codes)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 50) // Cap max codes per request
      : undefined;

    const parsedLimit = limit || 500;
    const parsedOffset = offset || 0;
    const fieldList = fields
      ? String(fields)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, 20)
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
router.get(
  "/:code",
  validateParams(courseCodeParamSchema),
  async (req, res) => {
    try {
      const code = req.params.code;
      const course = await getCourseByCode(code);
      if (!course) {
        return res.status(404).json({ error: "المساق غير موجود." });
      }
      return res.json(course);
    } catch (err) {
      console.error("Course by code error:", err);
      return res.status(500).json({ error: "فشل في جلب بيانات المساق." });
    }
  },
);

export default router;

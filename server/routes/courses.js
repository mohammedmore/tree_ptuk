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
    const { codes, search, limit, offset } = req.query;

    const codeList = codes
      ? String(codes)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined;

    const parsedLimit = limit ? Math.min(1000, Math.max(1, parseInt(String(limit), 10))) : 500;
    const parsedOffset = offset ? Math.max(0, parseInt(String(offset), 10)) : 0;

    const data = await getCourses({
      codes: codeList,
      search: search ? String(search) : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    const syncStatus = getSyncStatus();

    res.set("X-Last-Sync-Time", syncStatus.lastSyncTime || "");
    res.set("X-Total-Courses", String(data.length));

    return res.json(data);
  } catch (err) {
    console.error("Courses route error:", err);
    return res.status(500).json({
      error: "فشل في استعلام المواد من قاعدة البيانات.",
      details: err.message,
    });
  }
});

/**
 * GET /api/courses/:code
 */
router.get("/:code", async (req, res) => {
  try {
    const course = await getCourseByCode(req.params.code);
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

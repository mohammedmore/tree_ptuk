import express from "express";
import { getMajors, getMajorById, upsertMajor } from "../db.js";
import { requireAdminAuth } from "../middleware/security.js";
import {
  validateParams,
  validateBody,
  majorParamSchema,
  majorBodySchema,
} from "../validators.js";

const router = express.Router();

/**
 * GET /api/majors
 * List all available university majors.
 */
router.get("/", (req, res) => {
  try {
    const majors = getMajors();
    return res.json(majors);
  } catch (err) {
    console.error("Majors list error:", err.message || err);
    return res.status(500).json({ error: "فشل في جلب قائمة التخصصات." });
  }
});

/**
 * GET /api/majors/:majorId
 * Get comprehensive curriculum and study plan for a specific major.
 */
router.get("/:majorId", validateParams(majorParamSchema), (req, res) => {
  try {
    const { majorId } = req.params;
    const major = getMajorById(majorId);

    if (!major) {
      return res.status(404).json({ error: `التخصص (${majorId}) غير موجود.` });
    }

    return res.json(major);
  } catch (err) {
    console.error("Major by id error:", err.message || err);
    return res.status(500).json({ error: "فشل في جلب تفاصيل التخصص." });
  }
});

/**
 * POST /api/majors
 * Add or update a major and its curriculum.
 * Protected: Requires admin authorization.
 */
router.post(
  "/",
  requireAdminAuth,
  validateBody(majorBodySchema),
  (req, res) => {
    try {
      const majorData = req.body;
      const updated = upsertMajor(majorData);
      return res.json({ success: true, major: updated });
    } catch (err) {
      console.error("Upsert major error:", err.message || err);
      return res.status(500).json({ error: "فشل في حفظ التخصص." });
    }
  },
);

export default router;

import express from "express";
import { getMajors, getMajorById, upsertMajor } from "../db.js";
import { requireAdminAuth } from "../middleware/security.js";

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
router.get("/:majorId", (req, res) => {
  try {
    const { majorId } = req.params;

    // ─── Input Validation ───────────────────────────────────────────
    if (!majorId || typeof majorId !== "string" || majorId.length > 50) {
      return res.status(400).json({ error: "معرف التخصص غير صالح." });
    }

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
router.post("/", requireAdminAuth, (req, res) => {
  try {
    const majorData = req.body;

    // ─── Input Validation ───────────────────────────────────────────
    if (
      !majorData ||
      typeof majorData.id !== "string" ||
      typeof majorData.name !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "البيانات غير مكتملة: مطلوب id و name كنصوص." });
    }

    if (majorData.id.length > 50 || majorData.name.length > 200) {
      return res.status(400).json({ error: "البيانات تتجاوز الطول المسموح." });
    }

    const updated = upsertMajor(majorData);
    return res.json({ success: true, major: updated });
  } catch (err) {
    console.error("Upsert major error:", err.message || err);
    return res.status(500).json({ error: "فشل في حفظ التخصص." });
  }
});

export default router;

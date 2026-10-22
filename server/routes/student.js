import express from "express";
import { authenticateAndSyncStudent } from "../services/studentPortalService.js";
import { getStudentRecord } from "../db.js";

const router = express.Router();

/**
 * POST /api/student/sync
 * Authenticate student with University ID and Password, then synchronize plan and schedule.
 */
router.post("/sync", async (req, res) => {
  try {
    const { studentId, password, demoMode } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "الرقم الجامعي مطلوب." });
    }

    const studentRecord = await authenticateAndSyncStudent(studentId, password, {
      demoMode: Boolean(demoMode),
    });

    return res.json({
      success: true,
      message: "تمت مزامنة بيانات الطالب بنجاح.",
      data: studentRecord,
    });
  } catch (err) {
    console.error("Student sync error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "فشلت عملية مزامنة بيانات الطالب.",
    });
  }
});

/**
 * GET /api/student/:studentId
 * Get cached student record.
 */
router.get("/:studentId", (req, res) => {
  try {
    const { studentId } = req.params;
    const record = getStudentRecord(studentId);

    if (!record) {
      return res.status(404).json({ error: "لم يتم العثور على سجل مسبق للطالب." });
    }

    return res.json({ success: true, data: record });
  } catch (err) {
    console.error("Get student record error:", err);
    return res.status(500).json({ error: "فشل في قراءة بيانات الطالب." });
  }
});

export default router;

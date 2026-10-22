import express from "express";
import { getSyncStatus, upsertCatalogCourses, supabase } from "../db.js";
import { runSyncCycle } from "../services/scheduler.js";
import scrapePTUKSchedules from "../../src/services/ptukScraper.js";

const router = express.Router();

/**
 * GET /api/sync/status
 * Returns current sync status, last update time, and counts.
 */
router.get("/status", (req, res) => {
  try {
    const status = getSyncStatus();
    return res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    console.error("Sync status error:", err);
    return res.status(500).json({ error: "فشل في استعلام حالة المزامنة." });
  }
});

/**
 * POST /api/sync/trigger
 * Manually trigger background synchronization.
 */
router.post("/trigger", async (req, res) => {
  try {
    // Run asynchronously or await
    const result = await runSyncCycle({ manual: true });
    return res.json(result);
  } catch (err) {
    console.error("Trigger sync error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sync-ptuk (Legacy manual cookie/viewState sync support)
 */
router.post("/ptuk", async (req, res) => {
  const { cookie, viewState } = req.body;

  if (!cookie || !viewState) {
    return res
      .status(400)
      .json({ error: "مطلوب إرسال cookie و viewState في جسم الطلب." });
  }

  try {
    console.log("⏳ بدء سحب البيانات ومزامنتها مع الخادم...");
    const catalog = await scrapePTUKSchedules(cookie, viewState);

    const upsertStats = await upsertCatalogCourses(catalog);

    // Also update Supabase if configured
    if (supabase) {
      try {
        for (const item of catalog) {
          await supabase.from("courses").upsert(
            { code: item.code, name: item.name, type: item.type },
            { onConflict: "code" },
          );
        }
      } catch (sbErr) {
        console.warn("Supabase upsert warning:", sbErr.message);
      }
    }

    return res.json({
      success: true,
      coursesCount: upsertStats.totalCourses,
      sectionsCount: upsertStats.insertedSections,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

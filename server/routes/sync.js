import express from "express";
import {
  getSyncStatus,
  upsertCatalogCourses,
  batchUpsertToSupabase,
  acquireSyncLock,
  releaseSyncLock,
  supabase,
} from "../db.js";
import { runSyncCycle } from "../services/scheduler.js";
import scrapePTUKSchedules from "../services/scrapers/ptukScraper.js";
import { syncLimiter } from "../middleware/rateLimiters.js";
import { timingSafeEqualStrings } from "../services/securityVault.js";
import { validateBody, syncPtukSchema } from "../validators.js";

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
    console.error("Sync status error:", err.message || err);
    return res.status(500).json({ error: "فشل في استعلام حالة المزامنة." });
  }
});

function verifySyncAuth(req, res, next) {
  const syncApiKey = process.env.SYNC_API_KEY || process.env.ADMIN_API_KEY;
  if (syncApiKey) {
    const providedKey =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    if (!providedKey || !timingSafeEqualStrings(providedKey, syncApiKey)) {
      return res.status(401).json({ error: "غير مصرح. مفتاح API غير صالح." });
    }
  } else if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      error: "المزامنة اليدوية غير مفعلة بدون تهيئة SYNC_API_KEY في الإنتاج.",
    });
  }
  next();
}

/**
 * POST /api/sync/trigger
 * Manually trigger background synchronization.
 * Protected by sync-specific rate limiter and API key.
 */
router.post("/trigger", syncLimiter, verifySyncAuth, async (req, res) => {
  try {
    const result = await runSyncCycle({ manual: true });
    return res.json(result);
  } catch (err) {
    console.error("Trigger sync error:", err.message || err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sync-ptuk (Legacy manual cookie/viewState sync support)
 */
router.post(
  "/ptuk",
  syncLimiter,
  verifySyncAuth,
  validateBody(syncPtukSchema),
  async (req, res) => {
    const { cookie, viewState, branch } = req.body;

    if (!acquireSyncLock()) {
      return res.status(409).json({
        error: "عملية مزامنة أخرى قيد التشغيل بالفعل. يرجى الانتظار.",
      });
    }

    try {
      console.log("⏳ بدء سحب البيانات ومزامنتها مع الخادم...");
      const catalog = await scrapePTUKSchedules(cookie, viewState, {
        branch: typeof branch === "string" ? branch : "1",
      });

      const upsertStats = await upsertCatalogCourses(catalog);

      // Also update Supabase in batches if configured
      let supabaseResult = null;
      if (supabase) {
        try {
          supabaseResult = await batchUpsertToSupabase(catalog);
        } catch (sbErr) {
          console.warn(
            "⚠️ تحذير: فشل تحديث Supabase، تم الاكتفاء بالتخزين المحلي:",
            sbErr.message,
          );
        }
      }

      return res.json({
        success: true,
        message: `تمت مزامنة ${upsertStats.insertedCourses} مساق بنجاح.`,
        stats: {
          ...upsertStats,
          supabase: supabaseResult,
        },
      });
    } catch (err) {
      console.error("Manual sync failed:", err.message || err);
      return res.status(500).json({
        error: "فشلت عملية المزامنة.",
        details:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    } finally {
      releaseSyncLock();
    }
  },
);

export default router;

import cron from "node-cron";
import { authenticatePTUK } from "./scrapers/authService.js";
import { scrapePTUKSchedules } from "./scrapers/ptukScraper.js";
import {
  upsertCatalogCourses,
  updateSyncStatus,
  getSyncStatus,
  acquireSyncLock,
  releaseSyncLock,
  batchUpsertToSupabase,
  supabase,
} from "../db.js";
import {
  optimizeSqliteDb,
  sqlitePruneExpiredSecurityState,
} from "../sqliteDb.js";
import { edugateCircuitBreaker } from "../utils/circuitBreaker.js";

const DEFAULT_SCHEDULE = process.env.SYNC_CRON_SCHEDULE || "*/30 * * * *";
let cronJob = null;

/**
 * Execute a complete PTUK schedule sync cycle.
 * @param {object} [options]
 * @param {boolean} [options.manual=false]
 */
export async function runSyncCycle(options = {}) {
  // Check Circuit Breaker before initiating sync cycle
  const circuitCheck = edugateCircuitBreaker.canExecute();
  if (!circuitCheck.allowed) {
    console.warn(`⚠️ [SCHEDULER] تخطي دورة المزامنة: ${circuitCheck.reason}`);
    return {
      success: false,
      message: circuitCheck.reason,
      syncStatus: getSyncStatus(),
    };
  }

  if (!acquireSyncLock()) {
    console.warn("⏳ عملية مزامنة أخرى قيد التشغيل بالفعل، تم تخطي هذا الطلب.");
    return {
      success: false,
      message: "Sync already in progress.",
      syncStatus: getSyncStatus(),
    };
  }

  const startTime = Date.now();
  console.log(
    `🚀 [${new Date().toLocaleString()}] بدء دورة المزامنة التلقائية لمساقات وشعب خضوري...`,
  );

  updateSyncStatus({
    lastSyncStatus: "running",
    lastErrorMessage: null,
  });

  try {
    const username = process.env.PTUK_USERNAME?.trim();
    const password = process.env.PTUK_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "لم يتم تعيين PTUK_USERNAME أو PTUK_PASSWORD في ملف .env للمزامنة التلقائية.",
      );
    }

    // 1. Authenticate to Edugate
    console.log("🔐 المصادقة مع بوابة Edugate عبر الحساب الجامعي المعرف...");
    const { cookie, viewState } = await authenticatePTUK();

    // 2. Scrape schedules
    console.log("📄 جاري سحب الشعب الدراسية من صفحات الجدول...");
    const catalog = await scrapePTUKSchedules(cookie, viewState);

    if (!Array.isArray(catalog) || catalog.length === 0) {
      throw new Error("لم يتم إرجاع أي مواد أو شعب من خوادم خضوري.");
    }

    // 3. Upsert into local database
    const upsertStats = await upsertCatalogCourses(catalog);

    // 4. Batch upsert into Supabase with retry handling
    if (supabase) {
      try {
        console.log(
          "☁️ مزامنة البيانات بالدفعات مع Supabase (Batch Upsert)...",
        );
        await batchUpsertToSupabase(catalog);
      } catch (sbErr) {
        console.warn("⚠️ تعذر التحديث في Supabase:", sbErr.message);
      }
    }

    const durationSeconds = Number(
      ((Date.now() - startTime) / 1000).toFixed(2),
    );
    const nowIso = new Date().toISOString();

    const updatedStatus = updateSyncStatus({
      lastSyncTime: nowIso,
      lastSyncStatus: "success",
      totalCourses: upsertStats.totalCourses,
      totalSections: upsertStats.insertedSections,
      durationSeconds,
      lastErrorMessage: null,
    });

    console.log(
      `✅ تمت المزامنة بنجاح خلال ${durationSeconds} ثانية! (إجمالي المواد: ${upsertStats.totalCourses}، إجمالي الشعب: ${upsertStats.insertedSections})`,
    );

    edugateCircuitBreaker.recordSuccess();

    return {
      success: true,
      durationSeconds,
      upsertStats,
      syncStatus: updatedStatus,
    };
  } catch (error) {
    edugateCircuitBreaker.recordFailure(error);
    const durationSeconds = Number(
      ((Date.now() - startTime) / 1000).toFixed(2),
    );
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ فشلت دورة المزامنة: ${message}`);

    const failedStatus = updateSyncStatus({
      lastSyncStatus: "error",
      lastErrorMessage: message,
      durationSeconds,
    });

    return {
      success: false,
      error: message,
      durationSeconds,
      syncStatus: failedStatus,
    };
  } finally {
    releaseSyncLock();
  }
}

/**
 * Prunes expired shared schedules and runs SQLite maintenance (Item 140).
 */
export async function runDatabaseMaintenance() {
  console.log("🧹 بدء دورة الصيانة الدورية وتفريغ البيانات المنتهية...");
  optimizeSqliteDb();
  sqlitePruneExpiredSecurityState();

  let prunedCount = 0;
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("shared_schedules")
        .delete({ count: "exact" })
        .lt("expires_at", new Date().toISOString());

      if (!error && typeof count === "number") {
        prunedCount = count;
      }
    } catch (err) {
      console.warn("⚠️ Pruning expired shared schedules error:", err.message);
    }
  }

  console.log(
    `✨ اكتملت الصيانة الدورية بنجاح (تم تفريغ ${prunedCount} جدول منتهي الصلاحية).`,
  );
  return { success: true, prunedSharedSchedules: prunedCount };
}

/**
 * Initializes and starts the background sync scheduler.
 */
export function startScheduler() {
  if (cronJob) {
    console.log("⚠️ المجدول التلقائي يعمل مسبقاً.");
    return;
  }

  console.log(`⏰ تفعيل مجدول المزامنة التلقائي بجدول: (${DEFAULT_SCHEDULE})`);

  cronJob = cron.schedule(
    DEFAULT_SCHEDULE,
    () => {
      void runSyncCycle();
    },
    {
      name: "ptuk-auto-sync-worker",
    },
  );

  // Calculate approximate next sync time
  const nextRun = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  updateSyncStatus({
    nextScheduledSync: nextRun,
    syncIntervalCron: DEFAULT_SCHEDULE,
  });
}

/**
 * Stop background scheduler.
 */
export function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("🛑 تم إيقاف مجدول المزامنة التلقائي.");
  }
}

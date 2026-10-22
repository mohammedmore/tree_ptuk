import cron from "node-cron";
import { authenticatePTUK } from "../../src/services/authService.js";
import { scrapePTUKSchedules } from "../../src/services/ptukScraper.js";
import {
  upsertCatalogCourses,
  updateSyncStatus,
  getSyncStatus,
  supabase,
} from "../db.js";

const DEFAULT_SCHEDULE = process.env.SYNC_CRON_SCHEDULE || "*/30 * * * *";
let isSyncRunning = false;
let cronJob = null;

/**
 * Execute a complete PTUK schedule sync cycle.
 * @param {object} [options]
 * @param {boolean} [options.manual=false]
 */
export async function runSyncCycle(options = {}) {
  if (isSyncRunning) {
    console.warn("⏳ عملية مزامنة أخرى قيد التشغيل بالفعل، تم تخطي هذا الطلب.");
    return {
      success: false,
      message: "Sync already in progress.",
      syncStatus: getSyncStatus(),
    };
  }

  isSyncRunning = true;
  const startTime = Date.now();
  console.log(`🚀 [${new Date().toLocaleString()}] بدء دورة المزامنة التلقائية لمساقات وشعب خضوري...`);

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

    // 4. Also upsert into Supabase if connected
    if (supabase) {
      try {
        console.log("☁️ مزامنة البيانات مع Supabase...");
        for (const item of catalog) {
          await supabase.from("courses").upsert(
            { code: item.code, name: item.name, type: item.type },
            { onConflict: "code" },
          );
        }
      } catch (sbErr) {
        console.warn("⚠️ تعذر التحديث في Supabase:", sbErr.message);
      }
    }

    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
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

    return {
      success: true,
      durationSeconds,
      upsertStats,
      syncStatus: updatedStatus,
    };
  } catch (error) {
    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
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
    isSyncRunning = false;
  }
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

  cronJob = cron.schedule(DEFAULT_SCHEDULE, () => {
    void runSyncCycle();
  }, {
    name: "ptuk-auto-sync-worker",
  });

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

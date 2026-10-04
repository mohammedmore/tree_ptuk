import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import { runPTUKSync } from "./autoSync.js";

const SCHEDULE = "*/30 * * * *";
const LAST_SYNC_FILE = fileURLToPath(
  new URL("../last_sync.txt", import.meta.url),
);
const ALREADY_SYNCED_MESSAGE = "تم التحديث مسبقاً هذا اليوم";
let syncInProgress = false;

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function hasSyncedToday() {
  try {
    const lastSyncDate = (await readFile(LAST_SYNC_FILE, "utf8")).trim();
    return lastSyncDate === getToday();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function markAsSynced() {
  await writeFile(LAST_SYNC_FILE, getToday(), "utf8");
}

async function checkAndSync() {
  if (syncInProgress) {
    console.warn("Skipping PTUK sync: a previous run is still active.");
    return;
  }

  syncInProgress = true;

  try {
    if (await hasSyncedToday()) {
      console.log(ALREADY_SYNCED_MESSAGE);
      return;
    }

    console.log(`Starting PTUK sync at ${new Date().toLocaleString()}.`);
    await runPTUKSync();
    await markAsSynced();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`PTUK sync failed: ${message}`);
  } finally {
    syncInProgress = false;
  }
}

cron.schedule(SCHEDULE, checkAndSync, {
  name: "ptuk-30-minute-sync",
});

console.log(
  `PTUK sync scheduler is running; checking every 30 minutes (${SCHEDULE}).`,
);

await checkAndSync();

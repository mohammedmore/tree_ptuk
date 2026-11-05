import app, { startServer } from "./server/app.js";
import { supabase, persistStateSync } from "./server/db.js";
import { getSqliteDb } from "./server/sqliteDb.js";
import { closeSharedBrowser } from "./server/services/studentPortalService.js";

const PORT = process.env.PORT || 3001;

const server = startServer(PORT);

// Graceful Shutdown handling for SIGTERM and SIGINT
function handleShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

  // Close HTTP server to stop accepting new requests
  server.close(async () => {
    console.log("🔒 HTTP server closed.");
    try {
      persistStateSync();
      console.log("💾 State persisted to disk.");
    } catch (e) {
      console.warn("Error persisting state during shutdown:", e.message);
    }

    // Clean up Playwright headless browser instances to prevent zombie processes
    try {
      await closeSharedBrowser();
      console.log("🌐 Playwright browser instances closed cleanly.");
    } catch (e) {
      console.warn("Error closing Playwright browser:", e.message);
    }

    try {
      const sqlite = getSqliteDb();
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
      sqlite.close();
      console.log("🗄️ SQLite database connection closed with WAL checkpoint.");
    } catch {}

    process.exit(0);
  });

  // Force exit if shutdown hangs beyond 5 seconds
  setTimeout(() => {
    console.error("⚠️ Forcing exit after shutdown timeout.");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export { app, supabase, server };

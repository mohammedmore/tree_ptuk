import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import coursesRouter from "./routes/courses.js";
import majorsRouter from "./routes/majors.js";
import studentRouter from "./routes/student.js";
import syncRouter from "./routes/sync.js";
import { startScheduler } from "./services/scheduler.js";
import { getSyncStatus } from "./db.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health and meta endpoint
app.get("/api/health", (req, res) => {
  const syncStatus = getSyncStatus();
  return res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    sync: syncStatus,
  });
});

// Mount routers
app.use("/api/courses", coursesRouter);
app.use("/api/majors", majorsRouter);
app.use("/api/student", studentRouter);
app.use("/api/sync", syncRouter);

// Legacy backward-compatibility routes
app.post("/api/sync-ptuk", (req, res, next) => {
  req.url = "/ptuk";
  return syncRouter(req, res, next);
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled server error:", err);
  return res.status(500).json({
    error: "حدث خطأ غير متوقع في الخادم.",
    message: err.message,
  });
});

export function startServer(port = process.env.PORT || 3001) {
  const server = app.listen(port, () => {
    console.log(`🚀 السيرفر المطور يعمل بنجاح على: http://localhost:${port}`);
    // Start automated background sync scheduler
    startScheduler();
  });

  return server;
}

export default app;

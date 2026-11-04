import { spawn } from "node:child_process";

console.log(
  "🚀 Starting PTUK Planner Stack (Backend on Port 3001 + Frontend on Vite)...",
);

const backend = spawn("node", ["Server.js"], {
  stdio: "inherit",
  shell: true,
});

const frontend = spawn("npx", ["vite"], {
  stdio: "inherit",
  shell: true,
});

function cleanup() {
  try {
    backend.kill();
  } catch {}
  try {
    frontend.kill();
  } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("=== Testing Strict TypeScript Flags ===");

const flags = [
  "--noUncheckedIndexedAccess",
  "--exactOptionalPropertyTypes",
  "--noImplicitReturns",
  "--noFallthroughCasesInSwitch",
  "--noUnusedLocals",
  "--noUnusedParameters"
];

for (const flag of flags) {
  try {
    execSync(`npx tsc --noEmit ${flag}`, { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" });
    console.log(`${flag}: 0 errors`);
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : "";
    const lines = stdout.split("\n").filter(l => l.includes(": error TS"));
    console.log(`${flag}: ${lines.length} errors`);
    if (lines.length > 0) {
      console.log(`   Sample errors for ${flag}:`);
      lines.slice(0, 3).forEach(l => console.log(`     ${l.trim()}`));
    }
  }
}

console.log("\n=== Testing All Strict Flags Combined ===");
try {
  execSync(`npx tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitReturns --noFallthroughCasesInSwitch`, { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" });
  console.log("All 4 flags combined: 0 errors");
} catch (err) {
  const stdout = err.stdout ? err.stdout.toString() : "";
  const lines = stdout.split("\n").filter(l => l.includes(": error TS"));
  console.log(`All 4 flags combined: ${lines.length} errors`);
}

#!/usr/bin/env node

/**
 * Automated Illusion & Academic Inaccuracy Audit Scanner
 * Enforces real-world PTUK academic fidelity across all source code.
 * Fails with exit code 1 if any illusions or anti-patterns are introduced.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_SRC = path.resolve(__dirname, "..", "src");

const VIOLATIONS = [];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist") {
        results = results.concat(walk(fullPath));
      }
    } else if (
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".js")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(ROOT_SRC);

files.forEach((file) => {
  const relPath = path.relative(ROOT_SRC, file).replace(/\\/g, "/");
  // Skip test files, types, and official datasets
  if (
    relPath.includes("data.ts") ||
    relPath.includes("tuitionFeesService.ts") ||
    relPath.endsWith(".d.ts")
  ) {
    return;
  }

  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Ignore comments
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      return;
    }

    // 1. Check for dummy IDs (e.g. 202410001, 12000000, 202310123) outside placeholder hints
    if (
      !line.includes("placeholder=") &&
      !line.includes("مثال:") &&
      !line.includes("remedialCourseIds") &&
      !line.includes("15200099") &&
      !line.includes("15200106") &&
      !line.includes("13010006")
    ) {
      if (
        line.match(/\b(202410001|202310123|12000000)\b/) ||
        line.match(/studentId\s*=\s*["']202\d{6,}["']/)
      ) {
        VIOLATIONS.push({
          file: relPath,
          line: lineNum,
          type: "DUMMY_STUDENT_ID",
          message: `Found dummy hardcoded student ID in code: "${trimmed}"`,
        });
      }
    }

    // 2. Check for hardcoded major defaults in components (activeMajorName = "هندسة أنظمة الحاسوب")
    if (
      line.includes('activeMajorName = "هندسة أنظمة الحاسوب"') ||
      line.includes("activeMajorName = 'هندسة أنظمة الحاسوب'")
    ) {
      VIOLATIONS.push({
        file: relPath,
        line: lineNum,
        type: "HARDCODED_DEFAULT_MAJOR",
        message: `Component defaults activeMajorName to "هندسة أنظمة الحاسوب" instead of "الخطة الدراسية الجامعية": "${trimmed}"`,
      });
    }

    // 3. Check for outdated registration fee 50 JOD (PTUK official is 25 JOD)
    if (
      (line.includes("fixedFees") || line.includes("FixedFees")) &&
      (line.includes("|| 50") ||
        line.includes("?? 50") ||
        line.includes(": 50")) &&
      !line.includes("5000") &&
      !line.includes("50%")
    ) {
      VIOLATIONS.push({
        file: relPath,
        line: lineNum,
        type: "OUTDATED_REGISTRATION_FEE",
        message: `Found outdated registration fee (50 JOD). Official PTUK fee is 25 JOD: "${trimmed}"`,
      });
    }

    // 4. Check for outdated credit limits: regular 18 vs 19, or summer 9 vs 10
    if (
      line.includes(
        "isSummer ? (localHighGpa ? 10 : 9) : localHighGpa ? 21 : 18",
      ) ||
      line.includes("isSummer ? 9 : 18") ||
      line.includes("isSummer ? 10 : 9")
    ) {
      VIOLATIONS.push({
        file: relPath,
        line: lineNum,
        type: "OUTDATED_CREDIT_LIMITS",
        message: `Found outdated credit limit formula (18/9). Official PTUK limits are 19/10 (14/6 under warning): "${trimmed}"`,
      });
    }

    // 5. Check for hardcoded semester code in useState
    if (
      line.match(/useState\s*<\s*string\s*>\s*\(\s*["']20261["']\s*\)/) ||
      line.match(/useState\s*\(\s*["']20261["']\s*\)/) ||
      line.match(/useState\s*<\s*string\s*>\s*\(\s*["']20241["']\s*\)/)
    ) {
      VIOLATIONS.push({
        file: relPath,
        line: lineNum,
        type: "HARDCODED_SEMESTER_CODE",
        message: `Found static hardcoded semester code in state initializer: "${trimmed}"`,
      });
    }
  });
});

console.log("----------------------------------------------------");
console.log("🔍 Running PTUK Academic Integrity & Illusions Audit...");
console.log(`Scanned ${files.length} source files.`);

if (VIOLATIONS.length > 0) {
  console.error(
    `\n❌ AUDIT FAILED: Found ${VIOLATIONS.length} illusion(s) or inaccuracies:`,
  );
  VIOLATIONS.forEach((v, i) => {
    console.error(`  ${i + 1}. [${v.type}] ${v.file}:${v.line}`);
    console.error(`     ${v.message}`);
  });
  console.log("----------------------------------------------------\n");
  process.exit(1);
} else {
  console.log(
    "✅ AUDIT PASSED: 0 illusions found! All files comply with official academic regulations.",
  );
  console.log("----------------------------------------------------\n");
  process.exit(0);
}

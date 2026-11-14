import fs from "node:fs";

function analyzeFunctionLengths(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  const results = [];
  let currentFn = null;
  let braceDepth = 0;
  let startLine = 0;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Simple heuristic for function start
    const fnMatch = line.match(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)|(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
    if (fnMatch && braceDepth === 0) {
      if (currentFn) {
        results.push({ name: currentFn, start: startLine, end: lineNum - 1, length: (lineNum - startLine) });
      }
      currentFn = fnMatch[1] || fnMatch[2];
      startLine = lineNum;
    }
  });
  if (currentFn) {
    results.push({ name: currentFn, start: startLine, end: lines.length, length: (lines.length - startLine) });
  }
  return results.sort((a,b) => b.length - a.length);
}

const keyFiles = [
  "server/services/studentPortalService.js",
  "src/pages/RegistrationPage.tsx",
  "src/components/modals/WeeklyScheduleModal.tsx",
  "src/pages/CoursesPage.tsx",
  "src/pages/SemesterPlanningPage.tsx",
  "src/App.tsx",
  "src/pages/PlanPage.tsx",
  "src/services/scheduleSolver.ts"
];

for (const file of keyFiles) {
  console.log(`\n=== Longest Functions in ${file} ===`);
  const fns = analyzeFunctionLengths(file);
  fns.slice(0, 5).forEach(f => {
    console.log(`  ${f.name}: lines ${f.start}-${f.end} (${f.length} lines)`);
  });
}

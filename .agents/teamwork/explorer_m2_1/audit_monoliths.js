import fs from "node:fs";

const files = [
  "server/services/studentPortalService.js",
  "src/pages/RegistrationPage.tsx",
  "src/components/modals/WeeklyScheduleModal.tsx",
  "src/pages/CoursesPage.tsx",
  "src/pages/SemesterPlanningPage.tsx",
  "src/App.tsx",
  "src/pages/PlanPage.tsx",
  "src/pages/WeeklySchedulePage.tsx",
  "src/pages/GPAPage.tsx",
  "src/services/scheduleSolver.ts"
];

console.log("=== Monolithic Files Deep-Dive ===");

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  const lineCount = lines.length;

  const useStateCount = (content.match(/useState\s*\(/g) || []).length;
  const useEffectCount = (content.match(/useEffect\s*\(/g) || []).length;
  const useMemoCount = (content.match(/useMemo\s*\(/g) || []).length;
  const useCallbackCount = (content.match(/useCallback\s*\(/g) || []).length;
  const useRefCount = (content.match(/useRef\s*\(/g) || []).length;

  // Approximate functions
  const fnCount = (content.match(/(?:function\s+[a-zA-Z0-9_$]+|const\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g) || []).length;

  console.log(`\nFile: ${file}`);
  console.log(`  Lines: ${lineCount}`);
  if (file.endsWith(".tsx")) {
    console.log(`  React Hooks: useState=${useStateCount}, useEffect=${useEffectCount}, useMemo=${useMemoCount}, useCallback=${useCallbackCount}, useRef=${useRefCount}`);
    console.log(`  Total Hook Invocations: ${useStateCount + useEffectCount + useMemoCount + useCallbackCount + useRefCount}`);
  }
  console.log(`  Function definitions: ~${fnCount}`);
}

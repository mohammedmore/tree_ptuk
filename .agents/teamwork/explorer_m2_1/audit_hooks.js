import fs from "node:fs";

// Let's inspect useEffect usage in large components
const filesToCheck = [
  "src/pages/RegistrationPage.tsx",
  "src/pages/CoursesPage.tsx",
  "src/pages/SemesterPlanningPage.tsx",
  "src/pages/PlanPage.tsx",
  "src/App.tsx",
  "src/components/modals/WeeklyScheduleModal.tsx"
];

for (const file of filesToCheck) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  let useEffectCount = 0;
  let emptyDepsCount = 0;
  let noDepsCount = 0;

  lines.forEach((line, i) => {
    if (line.includes("useEffect(")) {
      useEffectCount++;
    }
  });

  console.log(`${file}: ${useEffectCount} useEffect hooks`);
}

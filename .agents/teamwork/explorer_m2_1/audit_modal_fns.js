import fs from "node:fs";

const content = fs.readFileSync("src/components/modals/WeeklyScheduleModal.tsx", "utf8");
const lines = content.split("\n");

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (/^(?:\/\*\*|\s*\/\/\s*===|export\s+(?:default\s+)?function|function\s+[a-zA-Z0-9_$]+|\s*const\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/.test(line)) {
    if (line.trim().length > 0 && !line.includes("useMemo") && !line.includes("useCallback")) {
      console.log(`${lineNum}: ${line.trim()}`);
    }
  }
});

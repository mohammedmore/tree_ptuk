import fs from "node:fs";

const content = fs.readFileSync("server/services/studentPortalService.js", "utf8");
const lines = content.split("\n");

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (/^(?:\/\*\*|\s*\/\/\s*===|export\s+(?:async\s+)?function|function\s+[a-zA-Z0-9_$]+)/.test(line)) {
    console.log(`${lineNum}: ${line.trim()}`);
  }
});

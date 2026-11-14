import fs from "node:fs";

const content = fs.readFileSync("src/core/graphLayout.ts", "utf8");
content.split(/\r?\n/).forEach((line, i) => {
  const match = line.match(/([a-zA-Z0-9_$\]\)])!(?!=)/);
  if (match) console.log(`${i+1}: ${line.trim()}`);
});

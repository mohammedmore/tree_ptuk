import fs from "node:fs";
import path from "node:path";

function getAllFiles(dir, exts, results = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== ".git") {
        getAllFiles(fullPath, exts, results);
      }
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const srcFiles = getAllFiles("src", [".ts", ".tsx", ".js"]);
const serverFiles = getAllFiles("server", [".ts", ".js", ".d.ts"]);

console.log(`srcFiles: ${srcFiles.length}, serverFiles: ${serverFiles.length}`);

// 1. Audit explicit any in src
let srcAnyMatches = [];
let srcAsAnyMatches = [];
let srcAsUnknownAsMatches = [];
let srcCatchAnyMatches = [];
let srcCatchUntypedMatches = [];
let srcNonNullMatches = [];

for (const f of srcFiles) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const relPath = path.relative(".", f).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    // as any
    if (/\bas\s+any\b/.test(line)) {
      srcAsAnyMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
    // as unknown as
    if (/as\s+unknown\s+as\b/.test(line)) {
      srcAsUnknownAsMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
    // catch (err: any)
    if (/catch\s*\([^)]*:\s*any\)/.test(line)) {
      srcCatchAnyMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
    // catch (e) or catch (err) without type
    if (/catch\s*\(\s*[a-zA-Z0-9_$]+\s*\)/.test(line)) {
      srcCatchUntypedMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
    // non-null assertion: ident! or )! or ]! not followed by =
    // e.g. foo! or foo()! or foo[bar]!
    const nonNullRegex = /([a-zA-Z0-9_$\]\)])!(?!=)/g;
    let match;
    while ((match = nonNullRegex.exec(line)) !== null) {
      // ignore != or !== which shouldn't match due to (?!=)
      // also verify it's not a boolean not like !foo
      srcNonNullMatches.push({ file: relPath, line: lineNum, text: trimmed, matched: match[0] });
    }

    // general explicit any: ': any', '<any>', 'any[]', '(any)'
    if (/:\s*any\b|Array<any>|\bany\[\]|<\s*any\s*>|\bas\s+any\b/.test(line)) {
      srcAnyMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
  });
}

// 2. Audit server any
let serverAnyMatches = [];
let serverAsAnyMatches = [];
for (const f of serverFiles) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const relPath = path.relative(".", f).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    if (/:\s*any\b|Array<any>|\bany\[\]|<\s*any\s*>|\bas\s+any\b/.test(line)) {
      serverAnyMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (/\bas\s+any\b/.test(line)) {
      serverAsAnyMatches.push({ file: relPath, line: lineNum, text: trimmed });
    }
  });
}

console.log("=== TypeScript Safety Metrics ===");
console.log(`src/ explicit any occurrences (including :any, <any>, any[], as any): ${srcAnyMatches.length}`);
console.log(`src/ 'as any' assertions: ${srcAsAnyMatches.length}`);
console.log(`src/ 'as unknown as ...' assertions: ${srcAsUnknownAsMatches.length}`);
console.log(`src/ catch(err: any): ${srcCatchAnyMatches.length}`);
console.log(`src/ untyped catch(err): ${srcCatchUntypedMatches.length}`);
console.log(`src/ non-null assertions (!): ${srcNonNullMatches.length}`);
console.log(`server/ explicit any occurrences: ${serverAnyMatches.length}`);

// Grouping by files
const groupByFile = (matches) => {
  const counts = {};
  matches.forEach(m => { counts[m.file] = (counts[m.file] || 0) + 1; });
  return Object.entries(counts).sort((a,b) => b[1] - a[1]);
};

console.log("\n=== Top Files with Explicit 'any' in src/ ===");
groupByFile(srcAnyMatches).slice(0, 10).forEach(([f, count]) => console.log(`  ${f}: ${count}`));

console.log("\n=== Top Files with Non-Null Assertions (!) in src/ ===");
groupByFile(srcNonNullMatches).slice(0, 10).forEach(([f, count]) => console.log(`  ${f}: ${count}`));

console.log("\n=== Top Files with 'as any' in src/ ===");
groupByFile(srcAsAnyMatches).slice(0, 10).forEach(([f, count]) => console.log(`  ${f}: ${count}`));

console.log("\n=== Top Files with 'as unknown as' in src/ ===");
groupByFile(srcAsUnknownAsMatches).slice(0, 10).forEach(([f, count]) => console.log(`  ${f}: ${count}`));

console.log("\n=== Top Files with explicit 'any' in server/ ===");
groupByFile(serverAnyMatches).slice(0, 10).forEach(([f, count]) => console.log(`  ${f}: ${count}`));

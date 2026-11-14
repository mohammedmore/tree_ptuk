const fs = require('fs');
const path = require('path');

function walk(d) {
  let res = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory() && !['node_modules', '.git', 'dist'].includes(e.name)) {
      res.push(...walk(f));
    } else if (e.isFile() && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
      res.push(f);
    }
  }
  return res;
}

// Strips comments: both // line comments and /* */ block comments
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

// Strips both comments and string literals
function stripCommentsAndStrings(code) {
  return code.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g,
    (match, str, comment) => {
      if (comment) return '';
      return '""';
    }
  );
}

const files = walk('src');
const regex = /[a-zA-Z0-9_\)\]]!(?![\=\!])/g;

let countRaw = 0;
let countStrippedComments = 0;
let countStrippedBoth = 0;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  countRaw += (content.match(regex) || []).length;
  countStrippedComments += (stripComments(content).match(regex) || []).length;
  countStrippedBoth += (stripCommentsAndStrings(content).match(regex) || []).length;
}

console.log('Raw matches:', countRaw);
console.log('Stripped comments only:', countStrippedComments);
console.log('Stripped comments and strings:', countStrippedBoth);

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

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

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const isJsx = f.endsWith('.tsx');
  const sf = ts.createSourceFile(f, content, ts.ScriptTarget.Latest, true, isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let astCount = 0;
  function v(n) {
    if (n.kind === ts.SyntaxKind.NonNullExpression) astCount++;
    ts.forEachChild(n, v);
  }
  v(sf);

  const stripped = stripCommentsAndStrings(content);
  const regexCount = (stripped.match(regex) || []).length;

  if (astCount !== regexCount) {
    console.log(path.relative('src', f).replace(/\\/g, '/'), 'AST:', astCount, 'regex:', regexCount);
  }
}

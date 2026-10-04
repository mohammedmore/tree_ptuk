const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "App.tsx");
let content = fs.readFileSync(file, "utf8");
content = content.replace(/\r\n/g, "\n");
fs.writeFileSync(file, content, "utf8");
console.log("Successfully converted CRLF to LF in App.tsx");

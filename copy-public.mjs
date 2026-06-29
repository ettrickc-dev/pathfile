// After Vite builds, copy the blank PDFs and the field index into dist/ so the
// Netlify functions can fetch them at stable URLs (/blanks/<FORM>.pdf).
import fs from "fs";
import path from "path";
const dist = "dist";
const blanks = path.join(dist, "blanks");
fs.mkdirSync(blanks, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(".")) {
  if (f.toLowerCase().endsWith(".pdf")) { fs.copyFileSync(f, path.join(blanks, f)); n++; }
}
if (fs.existsSync("field_index.json")) fs.copyFileSync("field_index.json", path.join(dist, "field_index.json"));
console.log(`copy-public: copied ${n} blank PDFs to dist/blanks/`);

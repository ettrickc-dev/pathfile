/* ============================================================
   PathFile — Field index extractor
   ------------------------------------------------------------
   When you add a NEW blank form, or REPLACE a form with a newer
   USCIS version, run this once to read every fillable box in the
   PDF and write its map into src/field_index.json.

   HOW TO RUN (from the project folder):
     node scripts/extract_fields.mjs  I-130   public/blanks/I-130.pdf

   The first word is the form KEY (must match formsRegistry.js).
   The second is the path to the blank PDF.

   It updates src/field_index.json in place (adds or replaces that
   one form's entry). Nothing else is touched.
   ============================================================ */
import { PDFDocument, PDFName } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , code, pdfPath] = process.argv;
if (!code || !pdfPath) {
  console.error('Usage: node scripts/extract_fields.mjs <FORM_KEY> <path/to/blank.pdf>');
  process.exit(1);
}

const indexPath = new URL('../src/field_index.json', import.meta.url);

function pageNumberForField(field, pages) {
  // Find which page (1-based) the field's first widget sits on.
  try {
    const widgets = field.acroField.getWidgets();
    for (const w of widgets) {
      const pRef = w.P && w.P();
      if (!pRef) continue;
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].ref === pRef) return i + 1;
      }
    }
  } catch {}
  return 1;
}

function onValueForCheckbox(field) {
  // The "checked" export value, e.g. "/Y". Anything that is not Off.
  try {
    const widgets = field.acroField.getWidgets();
    for (const w of widgets) {
      const ap = w.getAppearances && w.getAppearances();
      const onStates = w.getOnValue && w.getOnValue();
      if (onStates) return '/' + onStates.asString().replace(/^\//, '');
    }
  } catch {}
  return '/1';
}

const bytes = readFileSync(pdfPath);
const doc = await PDFDocument.load(bytes, { throwOnInvalidObject: false, updateMetadata: false });
const form = doc.getForm();
const pages = doc.getPages();
const fields = form.getFields();

const rows = [];
for (const f of fields) {
  const name = f.getName();
  const ctor = f.constructor.name;
  const page = pageNumberForField(f, pages);
  let type = 't';
  let on = '';
  if (ctor.includes('CheckBox')) { type = 'c'; on = onValueForCheckbox(f); }
  else if (ctor.includes('RadioGroup')) { type = 'c'; on = onValueForCheckbox(f); }
  else if (ctor.includes('Dropdown') || ctor.includes('OptionList')) { type = 'h'; }
  else { type = 't'; }
  rows.push([name, page, type, on]);
}

let index = {};
try { index = JSON.parse(readFileSync(indexPath)); } catch {}
index[code] = rows;
writeFileSync(indexPath, JSON.stringify(index));

console.log(`Wrote ${rows.length} fields for ${code} into src/field_index.json`);
console.log('Next: open the filled PDF and check a few boxes line up. If a box is off,');
console.log('adjust that one row in src/pdfFiller.mjs (the field map for ' + code + ').');

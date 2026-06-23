# PathFile

A web app that fills out USCIS immigration forms for a person, then — after
payment — gives them the completed PDFs, simple instructions, an evidence
checklist, and where to mail the packet.

## Run it on your computer
```
npm install
npm run dev
```
Open the link it prints.

## Build it for the web
```
npm run build
```
Upload the `dist` folder (or use the GitHub + Netlify steps below).

## The two guides you'll actually use
- **HOW_TO_ADD_OR_UPDATE_A_FORM.md** — add a new form or update one to a newer version.
- **DEPLOY_GITHUB_NETLIFY.md** — put it online and keep it updated automatically.

## Where things live
- `src/formsRegistry.js` — ONE place for every form's fee, title, evidence, mailing, signing, and PDF. Edit this to add or change a form.
- `src/pdfFiller.mjs` — which answer goes in which box on each PDF.
- `src/field_index.json` — the list of every box in each PDF (made by the script below).
- `scripts/extract_fields.mjs` — reads a PDF and writes its box list into the index.
- `src/App.jsx` — the screens and the logic that decides which forms a person needs.
- `public/blanks/` — the blank USCIS PDFs.

## Note
The payment screen is a demo and does not charge anyone. Wire in a real
processor (e.g. Stripe) before taking money — see DEPLOY_GITHUB_NETLIFY.md.
This tool is not legal advice; users should verify fees and addresses at uscis.gov.

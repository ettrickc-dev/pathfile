# How to Add or Update a Form

You do NOT need to touch the whole app. Almost everything for one form
lives in **one file**: `src/formsRegistry.js`.

---

## A) Update a form to a newer USCIS version

Use this when USCIS puts out a new edition of a form you already have.

1. Download the new blank PDF from uscis.gov.
2. Rename it to match the old one (example: `I-130.pdf`) and drop it into
   `public/blanks/`, replacing the old file.
3. Re-read its boxes so the app knows where to type. In a terminal, run:
   ```
   node scripts/extract_fields.mjs I-130 public/blanks/I-130.pdf
   ```
   (Change `I-130` and the file name to the form you are updating.)
4. If the fee or instructions changed, edit that form's block in
   `src/formsRegistry.js`.
5. Test it (see "Test before you ship" below).

That's it.

---

## B) Add a brand-new form (a new service)

Say you want to add Form **I-90**.

1. **Drop the blank PDF in.** Put `I-90.pdf` into `public/blanks/`.

2. **Add one block to the registry.** Open `src/formsRegistry.js`, copy any
   existing block, and fill it in for I-90:
   ```js
   "I-90": {
     title: "Application to Replace Permanent Resident Card",
     who: "You (the green card holder)",
     role: "applicant",
     pdfFile: "I-90.pdf",
     fee: { paper: 465, online: 415, note: "Some renewals are free." },
     whereToFileUrl: "https://www.uscis.gov/i-90",
     sign: { part: "Part 7", who: "You", note: "Sign in black ink." },
     evidence: ["Copy of your current or expired green card", "..."],
   },
   ```
   Keep the key (`"I-90"`) the SAME everywhere: the PDF name, the registry,
   the field index, and the field map.

3. **Read the form's boxes.** Run:
   ```
   node scripts/extract_fields.mjs I-90 public/blanks/I-90.pdf
   ```
   This adds I-90 to `src/field_index.json` for you.

4. **Tell the app which answer goes in which box.** Open `src/pdfFiller.mjs`
   and add a small map for I-90 inside `buildMaps` (copy an existing one like
   `N400`). Each line is: `["<box name ending>", <page>, <the value>]`.
   The box names come from the file the script just wrote. You only need to
   map the boxes you actually want filled (name, date of birth, address, etc.).

5. **Make the app offer it.** If this is a new path/goal (not part of an
   existing package), add it to the triage questions and the `determine()`
   logic in `src/App.jsx`. If it just joins an existing package, add `add("I-90")`
   where that package is built.

6. **Test it.**

---

## Test before you ship

1. In a terminal, from the project folder:
   ```
   npm install
   npm run dev
   ```
2. Open the local link it prints. Walk through to the end and click
   **Download my completed package**.
3. Open the PDF. Check a few boxes landed in the right place. If one is off,
   fix just that one line in the form's map in `src/pdfFiller.mjs`.
4. When it looks good, build it:
   ```
   npm run build
   ```
   This makes the `dist` folder that gets put online.

---

## The short version

- **Money/fee/title/evidence/mailing/signing** → `src/formsRegistry.js`
- **Where each answer is typed on the PDF** → `src/pdfFiller.mjs`
- **The list of every box in a PDF** → made for you by `scripts/extract_fields.mjs`
- **Which forms a person gets** → `determine()` in `src/App.jsx`

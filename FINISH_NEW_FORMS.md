# Finish the 3 New Forms (I-90, I-751, I-129F)

I added these as real services. The questions, the fee, the evidence list, the
instructions, and the mailing address all work right now. The ONLY thing left
is the fillable blank PDF for each — I can't download those because USCIS blocks
automated downloads, so you grab them (it's one click each).

## Step 1 — Download the 3 official fillable forms

Open each link and click the form's PDF (the one called "Form I-90", etc.):

- I-90:    https://www.uscis.gov/i-90
- I-751:   https://www.uscis.gov/i-751
- I-129F:  https://www.uscis.gov/i-129f

Make sure you grab the **form** PDF, not the "instructions" PDF.

## Step 2 — Rename and drop them in

Rename the downloaded files to EXACTLY these names and put them in the
`public/blanks/` folder, next to the forms already there:

- `I-90.pdf`
- `I-751.pdf`
- `I-129F.pdf`

## Step 3 — Read each form's boxes (one command each)

In a terminal, from the project folder, run these three lines:

```
node scripts/extract_fields.mjs I-90 public/blanks/I-90.pdf
node scripts/extract_fields.mjs I-751 public/blanks/I-751.pdf
node scripts/extract_fields.mjs I-129F public/blanks/I-129F.pdf
```

That teaches the app where every box on each form is.

## Step 4 — Test

```
npm run dev
```

Open the link, pick "Replace or renew my green card" (or one of the other new
options), go to the end, and click **Download my completed package**. Open the PDF and
check the name, date of birth, and address landed in the right spots.

I pre-filled a starter map for the common boxes (name, A-number, date of birth,
address). If one is slightly off, fix just that one line in `src/pdfFiller.mjs`
— look for the `I90`, `I751`, or `I129F` list near the bottom of `buildMaps`.
Each line is `["<box name>", <page>, <the value>]`. The exact box names are in
the file the script wrote (`src/field_index.json`).

## That's it

Once a PDF is in and its command has run, that form fills like all the others.
If you skip a form's PDF, the app still works — it just won't include that one
form's filled copy in the download until you add it.

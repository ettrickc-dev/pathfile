/* ============================================================
   PathFile — FORMS REGISTRY  (the one place you edit forms)
   ------------------------------------------------------------
   WANT TO ADD A NEW FORM OR UPDATE ONE? You only touch this file
   (and drop a PDF in /public/blanks). See HOW_TO_ADD_OR_UPDATE_A_FORM.md.

   Each form is ONE object. Fill in every field below. That's it —
   the rest of the app reads from here automatically:
     • the price/fee shown to the user
     • the form title + who signs it
     • the evidence checklist
     • where to mail it
     • the blank PDF file used to make the filled copy

   Keep the KEY (like "N-400") EXACTLY the same as:
     • the PDF file name in /public/blanks  (N-400.pdf)
     • the key inside src/field_index.json
     • the key inside the field map in src/pdfFiller.mjs
   ============================================================ */

export const FORMS = {
  "N-400": {
    title: "Application for Naturalization",
    who: "You (the green card holder)",
    role: "applicant",
    pdfFile: "N-400.pdf",
    fee: { paper: 760, online: 710, note: "Reduced fee $380 if household income is at/below 400% of the Federal Poverty Guidelines." },
    whereToFileUrl: "https://www.uscis.gov/n-400",
    sign: { part: "Part 12", who: "You, the applicant", note: "Sign in black ink after printing. A typed or digital signature is rejected. You also sign again in front of the officer at your interview." },
    evidence: [
      "Copy of your green card, front and back",
      "Two passport-style photos (only if you live outside the U.S.)",
      "If applying under the 3-year rule: marriage certificate + proof your spouse is a U.S. citizen",
      "Your complete trip history outside the U.S. since becoming a resident",
      "Court or name-change documents, if your name has changed",
      "Tax transcripts if any owed taxes or selective-service questions apply",
    ],
  },

  "N-600": {
    title: "Application for Certificate of Citizenship",
    who: "You (the person claiming citizenship)",
    role: "applicant",
    pdfFile: "N-600.pdf",
    fee: { paper: 1385, online: 1335, note: "$0 for U.S. military members/veterans filing for themselves, and for certain intercountry adoptees." },
    whereToFileUrl: "https://www.uscis.gov/n-600",
    sign: { part: "Part 9 (or Part 8 if a parent/guardian signs for a child under 14)", who: "You — or your parent/guardian if you are under 14", note: "Sign in black ink. A power of attorney cannot sign for an adult applicant." },
    evidence: [
      "Your foreign birth certificate (with certified English translation)",
      "Proof of your parent's U.S. citizenship: birth certificate, naturalization certificate, or U.S. passport",
      "Your parents' marriage certificate, and any divorce decrees from prior marriages",
      "Your green card, if you became a citizen after a parent naturalized",
      "Evidence you lived in your U.S. citizen parent's legal and physical custody (school, medical, or tax records)",
      "Final adoption decree, if you were adopted",
    ],
  },

  "I-130": {
    title: "Petition for Alien Relative",
    who: "The sponsor (petitioner)",
    role: "petitioner",
    pdfFile: "I-130.pdf",
    fee: { paper: 675, online: 625, note: "Establishes the qualifying family relationship." },
    whereToFileUrl: "https://www.uscis.gov/i-130",
    sign: { part: "Part 6", who: "The sponsor (petitioner) — NOT the immigrant", note: "Only the petitioner signs the I-130. The immigrant never signs this form. Black ink." },
    evidence: [
      "Proof of the petitioner's status: U.S. passport, naturalization certificate, or green card",
      "Proof of the relationship: marriage certificate (spouse) or birth certificates (parent/child/sibling)",
      "One passport-style photo of the petitioner and one of the beneficiary",
      "For spouses: proof the marriage is real — joint lease, joint bank accounts, photos, children's birth certificates",
      "Divorce or death certificates ending any prior marriages for either spouse",
    ],
  },

  "I-130A": {
    title: "Supplemental Information for Spouse Beneficiary",
    who: "The spouse seeking the green card",
    role: "beneficiary",
    pdfFile: "I-130A.pdf",
    fee: { paper: 0, online: 0, note: "No separate fee. Filed only when the relative is a spouse." },
    whereToFileUrl: "https://www.uscis.gov/i-130",
    sign: { part: "Part 4", who: "The spouse seeking the green card (beneficiary)", note: "The beneficiary spouse signs their own I-130A. Black ink." },
    evidence: [
      "No separate evidence. Complete and sign it, then file it inside the I-130 package.",
    ],
  },

  "I-485": {
    title: "Application to Register Permanent Residence or Adjust Status",
    who: "The immigrant (applicant)",
    role: "beneficiary",
    pdfFile: "I-485.pdf",
    fee: { paper: 1440, online: null, note: "$950 for an applicant under 14 filing with a parent's I-485. Paper filing only." },
    whereToFileUrl: "https://www.uscis.gov/i-485",
    sign: { part: "Part 9", who: "The immigrant (applicant)", note: "The applicant signs their own form in black ink. If under 14, a parent may sign." },
    evidence: [
      "Copy of your birth certificate with certified English translation",
      "Copy of your passport biographic page and most recent U.S. entry stamp",
      "Your Form I-94 arrival/departure record",
      "Two passport-style photos",
      "Sealed Form I-693 medical exam from a USCIS-approved civil surgeon",
      "Copy of the I-130 (or its receipt notice) and the sponsor's signed I-864",
      "Proof you were inspected and admitted or paroled (lawful entry)",
    ],
  },

  "I-765": {
    title: "Application for Employment Authorization",
    who: "The immigrant (applicant)",
    role: "beneficiary",
    pdfFile: "I-765.pdf",
    fee: { paper: 520, online: 470, note: "$260 if you have an I-485 filed on/after 04-01-2024 that is still pending. Often $0 in that scenario when filed together." },
    whereToFileUrl: "https://www.uscis.gov/i-765",
    sign: { part: "Part 3", who: "The immigrant (applicant)", note: "Sign in black ink, staying inside the box. A signature touching the edges can be rejected." },
    evidence: [
      "Copy of your I-94 and passport biographic page",
      "Two passport-style photos",
      "Copy of any prior Employment Authorization Document",
      "Copy of your I-485 receipt notice if filing for the (c)(9) pending-adjustment category",
    ],
  },

  "I-864": {
    title: "Affidavit of Support Under Section 213A",
    who: "The financial sponsor",
    role: "petitioner",
    pdfFile: "I-864.pdf",
    fee: { paper: 0, online: 0, note: "No filing fee. Filed by the financial sponsor." },
    whereToFileUrl: "https://www.uscis.gov/i-864",
    sign: { part: "Part 7", who: "The financial sponsor", note: "The sponsor signs under penalty of perjury. Black ink. Each joint sponsor signs a separate I-864." },
    evidence: [
      "Sponsor's federal tax return or IRS transcript for the most recent year",
      "Sponsor's W-2s and recent pay stubs, or an employer letter",
      "Proof of the sponsor's U.S. citizenship or permanent residence",
      "Evidence of assets, if income alone does not meet 125% of the poverty guidelines",
      "Form I-864A from any household member whose income is being combined",
    ],
  },

  "I-131": {
    title: "Application for Travel Document (Advance Parole)",
    who: "The immigrant (applicant)",
    role: "beneficiary",
    pdfFile: "I-131.pdf",
    fee: { paper: 630, online: 630, note: "Advance Parole travel permission while the green card is pending. Often $0 when filed together with an I-485." },
    whereToFileUrl: "https://www.uscis.gov/i-131-addresses",
    sign: { part: "Part 8", who: "The immigrant (applicant)", note: "The applicant signs in black ink." },
    evidence: [
      "Two passport-style photos",
      "Copy of your I-485 receipt notice (proves the green card is pending)",
      "Copy of a government photo ID with photo, name, and date of birth",
      "An explanation of why you need to travel, if requesting an emergency document",
    ],
  },

  "I-693": {
    title: "Report of Immigration Medical Exam and Vaccination Record",
    who: "The immigrant — completed by a USCIS civil surgeon",
    role: "beneficiary",
    pdfFile: "I-693.pdf",
    fee: { paper: 0, online: null, note: "No USCIS fee, but the USCIS-approved civil surgeon charges for the exam. The doctor seals it; you mail the sealed envelope unopened." },
    whereToFileUrl: "https://www.uscis.gov/i-693",
    sign: { part: "Signed by the civil surgeon and by you at the exam", who: "You and the USCIS civil surgeon", note: "Do not sign in advance. You sign in front of the surgeon; the surgeon seals it." },
    evidence: [
      "Do not complete this yourself — bring it to a USCIS-approved civil surgeon",
      "Your vaccination records to the appointment",
      "Government photo ID for the appointment",
      "The surgeon seals the finished form in an envelope — keep it sealed",
    ],
  },

  "G-1450": {
    title: "Authorization for Credit Card Transactions",
    who: "Whoever is paying the filing fees",
    role: "petitioner",
    pdfFile: "G-1450.pdf",
    fee: { paper: 0, online: null, note: "No fee. This authorizes USCIS to charge your credit card for the other forms' fees. Place it on top of the package." },
    whereToFileUrl: "https://www.uscis.gov/g-1450",
    sign: { part: "Signature line at the bottom", who: "The cardholder paying the fees", note: "The cardholder signs authorizing the charge. Black ink." },
    evidence: [
      "No evidence. Enter the card number, expiration, and billing details",
      "Total the exact filing fees for every paid form in the package",
      "Place this as the very first page of your mailed package",
    ],
  },

  /* ----------------------------------------------------------
     ADD A NEW FORM BELOW by copying one block above.
     Then: drop "<KEY>.pdf" in /public/blanks, add its field
     index, and add its field map in pdfFiller.mjs.
     Full steps: HOW_TO_ADD_OR_UPDATE_A_FORM.md
     ---------------------------------------------------------- */

  "I-90": {
    title: "Application to Replace Permanent Resident Card",
    who: "You (the green card holder)",
    role: "applicant",
    pdfFile: "I-90.pdf",
    fee: { paper: 465, online: 415, note: "Biometrics are included. $0 if the card has an error caused by USCIS, or if your card was issued but never delivered to you." },
    whereToFileUrl: "https://www.uscis.gov/i-90",
    sign: { part: "Part 6 (Applicant's signature)", who: "You, the applicant", note: "Sign in black ink. An unsigned form is rejected. If under 14, a parent or guardian signs." },
    evidence: [
      "Copy of your current or expired green card, front and back",
      "If lost, stolen, or never received: a government photo ID (passport or driver's license)",
      "Police report, if your card was stolen",
      "Marriage certificate, divorce decree, or court order, if your name changed",
      "If the card has a USCIS error: the incorrect card plus a note explaining the mistake",
    ],
  },

  "I-751": {
    title: "Petition to Remove Conditions on Residence",
    who: "You (the conditional green card holder), usually with your spouse",
    role: "applicant",
    pdfFile: "I-751.pdf",
    fee: { paper: 750, online: 750, note: "Same fee online or by mail. No fee if you are filing a waiver based on battery or extreme cruelty." },
    whereToFileUrl: "https://www.uscis.gov/i-751",
    sign: { part: "Part 7 (and your spouse signs too if filing jointly)", who: "You — and your spouse if this is a joint filing", note: "Both spouses sign a joint petition in black ink. File during the 90 days before your 2-year card expires." },
    evidence: [
      "Copy of the front and back of your 2-year (conditional) green card",
      "Proof the marriage is real: joint bank statements, joint lease or mortgage, joint bills",
      "Children's birth certificates showing both parents, if you have children together",
      "Photos together over time, and signed letters from people who know you both",
      "If filing a waiver (divorced, abuse, or hardship): the divorce decree or supporting proof",
    ],
  },

  "I-129F": {
    title: "Petition for Alien Fiancé(e) (K-1 visa)",
    who: "The U.S. citizen petitioner",
    role: "petitioner",
    pdfFile: "I-129F.pdf",
    fee: { paper: 675, online: 675, note: "Same fee online or by mail. Cannot be waived." },
    whereToFileUrl: "https://www.uscis.gov/i-129f",
    sign: { part: "Part 7 (Petitioner's signature)", who: "The U.S. citizen petitioner", note: "Only the U.S. citizen signs. Black ink." },
    evidence: [
      "Proof of the petitioner's U.S. citizenship: passport, birth certificate, or naturalization certificate",
      "Proof you met in person within the last 2 years (photos, plane tickets, hotel records)",
      "A signed statement from each of you saying you intend to marry within 90 days of entry",
      "One passport-style photo of the petitioner and one of the fiancé(e)",
      "Divorce decrees or death certificates ending any earlier marriages for either person",
    ],
  },
};

/* ---- Derived lookups (do NOT edit — built from FORMS above) ---- */
const codes = Object.keys(FORMS);

export const FEES = Object.fromEntries(codes.map((c) => [c, FORMS[c].fee]));
export const FORM_META = Object.fromEntries(codes.map((c) => [c, { title: FORMS[c].title, who: FORMS[c].who, role: FORMS[c].role }]));
export const EVIDENCE = Object.fromEntries(codes.map((c) => [c, FORMS[c].evidence]));
export const WHERE_TO_FILE = Object.fromEntries(codes.map((c) => [c, FORMS[c].whereToFileUrl]));
export const SIGN_INFO = Object.fromEntries(codes.map((c) => [c, FORMS[c].sign]));
export const PDF_FILES = Object.fromEntries(codes.map((c) => [c, FORMS[c].pdfFile]));


// ---- Mailing destinations (moved here as single source of truth) ----
export const MAILING = {
  familyConcurrent: {
    label: "Family-based green card package (I-130 + I-485 + everything filed together)",
    body: "Mail the entire package to the USCIS lockbox that serves your state for Form I-485. For most family-based filers this is the Phoenix lockbox:",
    usps: "USCIS, Attn: NFB, P.O. Box 21281, Phoenix, AZ 85036-1281",
    courier: "USCIS, Attn: NFB, 2108 E. Elliot Rd., Tempe, AZ 85284-1806 (FedEx/UPS/DHL)",
    verify: "Confirm your state's exact lockbox on the USCIS Lockbox Filing Locations Chart for family-based forms before mailing — a wrong address means rejection.",
    url: "https://www.uscis.gov/uscis-lockbox-filing-locations-chart",
  },
  "I-130": {
    label: "Form I-130 filed alone",
    body: "The I-130 lockbox depends on your state — generally the Elgin (IL) or Dallas (TX) lockbox.",
    verify: "Look up your state on the I-130 direct filing addresses page.",
    url: "https://www.uscis.gov/i-130-addresses",
  },
  "N-400": {
    label: "Form N-400 (naturalization)",
    body: "File online at my.uscis.gov when possible. If mailing, the lockbox depends on your state — usually the Phoenix, Elgin, or Dallas lockbox.",
    verify: "Confirm your state's address on the N-400 page.",
    url: "https://www.uscis.gov/n-400-addresses",
  },
  "N-600": {
    label: "Form N-600 (certificate of citizenship)",
    body: "File online, or mail to the USCIS lockbox listed for N-600 based on where you live.",
    verify: "Confirm the address on the N-600 page.",
    url: "https://www.uscis.gov/n-600",
  },
  "I-90": {
    label: "Form I-90 (replace green card)",
    body: "File online at my.uscis.gov (usually $50 cheaper), or mail to the Phoenix lockbox:",
    usps: "USCIS, Attn: I-90, P.O. Box 21262, Phoenix, AZ 85036-1262",
    courier: "USCIS, Attn: I-90 (Box 21262), 2108 E. Elliot Rd., Tempe, AZ 85284-1806 (FedEx/UPS/DHL)",
    verify: "Confirm this address on the I-90 page before mailing.",
    url: "https://www.uscis.gov/i-90",
  },
  "I-751": {
    label: "Form I-751 (remove conditions)",
    body: "The I-751 lockbox depends on your state — usually the Phoenix, Elgin, or Dallas lockbox.",
    verify: "Look up your state's exact address on the I-751 direct filing addresses page.",
    url: "https://www.uscis.gov/i-751",
  },
  "I-129F": {
    label: "Form I-129F (fiancé petition)",
    body: "File Form I-129F at the USCIS Dallas lockbox. Mail your whole packet here:",
    usps: "USCIS, Attn: I-129F, P.O. Box 660151, Dallas, TX 75266-0151",
    courier: "USCIS, Attn: I-129F (Box 660151), 2501 South State Highway 121 Business, Suite 400, Lewisville, TX 75067-8003 (FedEx/UPS/DHL)",
    verify: "This is the single national lockbox for I-129F. Confirm it hasn't changed on the I-129F page before mailing.",
    url: "https://www.uscis.gov/i-129f",
  },
};

// ---- Items the applicant completes BY HAND (not auto-filled) ----
export const HANDWRITE = {
  "N-400": [
    "Where You Have Lived (last 5 years): list every prior address with move-in and move-out dates. Your current address is already filled in.",
    "Time Outside the United States (last 5 years): list each trip, with the date you left and the date you returned.",
    "Employment and Schools (last 5 years): list each employer or school with its address and your dates there. Your current one is already filled in.",
    "Marital History: if you were married before, add each prior spouse and how that marriage ended.",
    "Information About Your Children: list each child's full legal name, date of birth, and A-Number (if they have one).",
    "Any remaining 'have you ever' boxes in the eligibility section that were left blank: mark 'No' in each.",
  ],
  "I-130": [
    "Petitioner — addresses and employment for the last 5 years: list each one with dates. Your current address and employer are already filled in.",
    "Beneficiary (your spouse) — address and employment history: list each one with dates.",
    "Beneficiary's prior spouse(s) and children, if any: add their full names and dates of birth.",
  ],
  "I-485": [
    "Address History (last 5 years): list every address with dates. Your current address is already filled in.",
    "Employment History (last 5 years): list every employer with dates. Your current employer is already filled in.",
    "Information About Your Parents: add their names and dates of birth if not already shown.",
    "Information About Your Children, if any: list each child's name and date of birth.",
    "Any remaining inadmissibility boxes left blank: mark 'No' in each.",
  ],
};

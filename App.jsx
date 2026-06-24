import React, { useReducer, useState, useMemo } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fillPackage, PDF_FILES, screenReferral } from "./pdfFiller.mjs";
import fieldIndex from "./field_index.json";
// Single source of truth for every form's fee, title, evidence, mailing, and signing.
// To add or change a form, edit src/formsRegistry.js — not this file.
import { FEES, FORM_META, EVIDENCE, WHERE_TO_FILE, SIGN_INFO } from "./formsRegistry.js";
import { BLANK_URLS } from "./blanks.js";

const todayStr = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function subjectName(d) {
  return [d.s_first, d.s_middle, d.s_last].filter(Boolean).join(" ") || "the applicant";
}

// Total USCIS fee for the package (paper amounts).
function totalFee(result) {
  return result.forms.reduce((s, f) => s + ((FEES[f.code] && FEES[f.code].paper) || 0), 0);
}

// Build the plain-text cover letter + instruction lines that go on the first pages
// of the completed PDF (and are shown on screen / printed).
function packageInstructions(result, data) {
  const name = subjectName(data);
  const anum = data.s_anum ? `A-Number: ${data.s_anum}` : "";
  const codes = result.forms.map((f) => f.code);
  const m = mailingFor(result);
  const fee = totalFee(result);
  const hasG1450 = codes.includes("G-1450");

  return { name, anum, m, fee, hasG1450, codes };
}

// Draw wrapped text onto Letter-size pages; returns when done.
function drawTextPages(pdf, lines, font, fontBold) {
  const W = 612, H = 792, margin = 64, size = 11, lh = 16, maxW = W - margin * 2;
  let page = pdf.addPage([W, H]);
  let y = H - margin;
  const wrap = (text, f, s) => {
    const words = String(text).split(" ");
    const out = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(t, s) > maxW && cur) { out.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  for (const ln of lines) {
    const bold = ln.bold;
    const f = bold ? fontBold : font;
    const s = ln.size || size;
    if (ln.gap) { y -= ln.gap; continue; }
    const segs = wrap(ln.text || "", f, s);
    for (const seg of segs) {
      if (y < margin + lh) { page = pdf.addPage([W, H]); y = H - margin; }
      page.drawText(seg, { x: margin, y, size: s, font: f, color: rgb(0.09, 0.16, 0.17) });
      y -= (ln.size ? ln.size + 5 : lh);
    }
    y -= (ln.after || 0);
  }
}

// Build ONE completed-package PDF: cover letter + instructions + all filled forms.
async function buildPackagePdf(clientData, result, data) {
  const getBlank = async (code) => {
    const url = BLANK_URLS[code];
    if (!url) throw new Error(`blank ${code} not loaded`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`blank ${code} not found`);
    return new Uint8Array(await res.arrayBuffer());
  };
  const formCodes = result.forms.map((f) => f.code);
  const filled = await fillPackage(clientData, formCodes, getBlank, fieldIndex);
  const included = filled.filter((r) => r.bytes).map((r) => r.code);
  const missing = filled.filter((r) => !r.bytes).map((r) => r.code);

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  const { name, m, fee, hasG1450 } = packageInstructions(result, data);
  const order = assemblyOrder(result);

  // --- Cover letter ---
  const lines = [
    { text: "U.S. Citizenship and Immigration Services", bold: true, size: 13 },
    { text: m.usps || m.label, after: 6 },
    { text: todayStr(), after: 10 },
    { text: `Re: ${result.caseType} — ${name}`, bold: true },
    { text: data.s_anum ? `A-Number: ${data.s_anum}` : "", after: 8 },
    { text: "To Whom It May Concern:" , after: 6 },
    { text: `Please find enclosed the following form(s) filed on behalf of ${name}:`, after: 6 },
  ];
  order.forEach((c) => lines.push({ text: `   • Form ${c} — ${FORM_META[c].title}`, }));
  lines.push({ gap: 6 });
  lines.push({ text: hasG1450
    ? `The total USCIS filing fee of $${fee.toLocaleString()} is authorized by the enclosed Form G-1450 (credit card).`
    : `The total USCIS filing fee is $${fee.toLocaleString()}.`, after: 8 });
  lines.push({ text: "All required supporting evidence is enclosed. Please direct any questions to the contact information provided on the forms.", after: 10 });
  lines.push({ text: "Respectfully,", after: 24 });
  lines.push({ text: "_______________________________" });
  lines.push({ text: `${name}`, after: 16 });

  // --- Instruction sheet (for the filer) ---
  lines.push({ gap: 10 });
  lines.push({ text: "YOUR FILING INSTRUCTIONS — read before mailing", bold: true, size: 13, after: 8 });

  lines.push({ text: "1. Sign each form (black ink, the correct person):", bold: true, after: 4 });
  order.forEach((c) => {
    const s = SIGN_INFO[c];
    if (s) lines.push({ text: `   • ${c}: ${s.part} — signed by ${s.who}.` });
  });
  lines.push({ gap: 6 });

  lines.push({ text: "2. Stack the package in this order:", bold: true, after: 4 });
  order.forEach((c, i) => lines.push({ text: `   ${i + 1}. ${c} — ${FORM_META[c].title}` }));
  lines.push({ gap: 6 });

  lines.push({ text: "3. Attach this evidence:", bold: true, after: 4 });
  order.forEach((c) => {
    (EVIDENCE[c] || []).forEach((e) => lines.push({ text: `   • [${c}] ${e}` }));
  });
  lines.push({ gap: 6 });

  lines.push({ text: "4. Pay the USCIS filing fee:", bold: true, after: 4 });
  lines.push({ text: hasG1450
    ? `   Total $${fee.toLocaleString()}. Enter this exact amount on Form G-1450 and place it on top of the package. USCIS no longer accepts checks for most forms.`
    : `   Total $${fee.toLocaleString()}, paid to USCIS. See the form's page for accepted payment methods.` });
  lines.push({ gap: 6 });

  lines.push({ text: "5. Mail your complete package to:", bold: true, after: 4 });
  lines.push({ text: `   ${m.label}` });
  if (m.usps) lines.push({ text: `   By USPS: ${m.usps}` });
  if (m.courier) lines.push({ text: `   By courier (FedEx/UPS/DHL): ${m.courier}` });
  lines.push({ text: `   IMPORTANT: where you mail this often depends on your home address. Confirm the correct address for your state at uscis.gov before mailing — a wrong address can get your package rejected.` });
  lines.push({ text: `   Official address page: ${m.url}`, after: 6 });

  if (missing.length) {
    lines.push({ gap: 8 });
    lines.push({ text: `NOTE: These form(s) are not yet included because their blank PDF has not been added to this PathFile install: ${missing.join(", ")}.`, bold: true });
  }

  drawTextPages(out, lines, font, fontBold);

  // --- Append each filled form, in assembly order ---
  for (const code of order) {
    const r = filled.find((x) => x.code === code);
    if (!r || !r.bytes) continue;
    try {
      const src = await PDFDocument.load(r.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch { /* skip a form that won't copy */ }
  }

  const bytes = await out.save();
  return { bytes, included, missing };
}

async function downloadCompletedPackage(clientData, result, data, setStatus) {
  try {
    if (screenReferral(clientData).length) {
      setStatus && setStatus("This case needs attorney review — no package generated.");
      return;
    }
    setStatus && setStatus("Building your completed package…");
    const { bytes, included, missing } = await buildPackagePdf(clientData, result, data);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "PathFile_USCIS_Package.pdf"; a.click();
    URL.revokeObjectURL(url);
    setStatus && setStatus(
      missing.length
        ? `Package downloaded with ${included.length} completed form(s). Still pending a blank PDF: ${missing.join(", ")}.`
        : `Done. Your completed package (${included.length} form${included.length > 1 ? "s" : ""} + cover letter + instructions) downloaded.`
    );
  } catch (e) {
    setStatus && setStatus("Could not build package: " + (e.message || e));
  }
}

/* ============================================================
   PathFile — Immigration Form Assistant
   A guided tool that triages your situation, decides which USCIS
   forms apply (N-400, N-600, I-130, I-130A, I-485, I-765, I-864),
   builds an evidence checklist + mailing plan, collects your info,
   drafts the forms, and unlocks a prepared copy after payment.

   Not legal advice. Verify all forms, fees, and addresses at uscis.gov.
   ============================================================ */

/* FEES, FORM_META, EVIDENCE, WHERE_TO_FILE, SIGN_INFO now come from src/formsRegistry.js */

/* Specific mailing — verified mid-2026. Lockbox depends on state + category. */
const MAILING = {
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

/* ---------- Triage engine ---------- */
const GOALS = [
  { id: "naturalize", label: "Apply to become a U.S. citizen", sub: "I already have a green card" },
  { id: "certificate", label: "Get proof I'm already a U.S. citizen", sub: "Through my U.S. citizen parent(s)" },
  { id: "sponsor", label: "Help a relative immigrate", sub: "I'm the sponsor / petitioner" },
  { id: "selfgc", label: "Get a green card for myself", sub: "I'm the immigrant, a relative will sponsor me" },
  { id: "replace_card", label: "Replace or renew my green card", sub: "Lost, stolen, expiring, damaged, or has an error" },
  { id: "remove_conditions", label: "Remove conditions on my green card", sub: "I have a 2-year card from marriage" },
  { id: "fiance", label: "Bring my fiancé(e) to the U.S.", sub: "K-1 visa — we plan to marry within 90 days" },
];

function isImmediateRelative(petitionerStatus, relationship) {
  // Immediate relatives of a U.S. citizen have a visa always available.
  if (petitionerStatus !== "USC") return false;
  return ["spouse", "parent", "child_u21"].includes(relationship);
}

/* Hard screen: situations we will NOT sell a self-prep package for, because the
   case may not be fileable as-is and a wrong filing can cost the fee — or worse,
   trigger removal. These route straight to attorney review. */
function screenForReferral(a) {
  const reasons = [];
  const fam = a.goal === "sponsor" || a.goal === "selfgc";
  const entry = a.goal === "sponsor" ? a.rel_entry : a.entry;
  const inUS = a.goal === "sponsor" ? a.rel_in_us : a.in_us;

  // Entry without inspection (or unconfirmed) + adjusting inside the U.S.:
  // unlawful-presence bars, §245(i), and I-601A waivers are attorney territory.
  if (fam && inUS === "yes" && (entry === "no" || entry === "unsure")) reasons.push("entry");
  if (a.removal === "yes" || a.removal === "unsure") reasons.push("removal");
  if (a.crim === "yes" || a.crim === "unsure") reasons.push("crim");

  return { refer: reasons.length > 0, reasons };
}

const REFERRAL_TEXT = {
  entry: "It looks like the immigrant may have entered without inspection (or it isn't confirmed). That affects whether a green card can be obtained inside the U.S. at all, and may involve unlawful-presence bars and a waiver. This needs an attorney before anything is filed.",
  removal: "A past removal/deportation order or an open immigration court case changes everything about how — and whether — to file. Filing the wrong thing here can cause serious harm. An attorney must handle this.",
  crim: "Any arrest or charge, even an old or dismissed one, can affect eligibility and, in some cases, lead to removal. An attorney should review the records before any form is filed.",
};

function determine(a) {
  // Screen first — never sell a package for a case that may not be fileable.
  const screen = screenForReferral(a);
  if (screen.refer) {
    return {
      refer: true,
      reasons: screen.reasons,
      title: "Your case needs an immigration attorney before filing",
      caseType: "Attorney review required",
      forms: [],
      notes: [],
    };
  }

  const forms = [];
  const notes = [];
  let title = "";
  let caseType = "";

  const add = (code, opts = {}) => forms.push({ code, ...opts });

  if (a.goal === "naturalize") {
    caseType = "Naturalization";
    title = "Apply for U.S. citizenship";
    // Catch the common confusion: already a citizen via parent.
    if (a.derived_already === "yes") {
      add("N-600", { recommended: true });
      title = "You may already be a citizen — request the certificate";
      notes.push("Because you appear to have automatically become a citizen when your parent naturalized before you turned 18, you likely do NOT need to naturalize. File N-600 to get a Certificate of Citizenship instead of N-400.");
      caseType = "Citizenship certificate";
    } else {
      add("N-400", { recommended: true });
      if (a.lpr_years === "lt3" && a.married_usc !== "yes") {
        notes.push("Heads up: most applicants need 5 years as a permanent resident (or 3 years if married to and living with a U.S. citizen). You can still prepare your N-400 now and file once you reach eligibility.");
      }
      if (a.married_usc === "yes") {
        notes.push("You qualify under the 3-year married-to-a-citizen rule. Include your marriage certificate and proof of your spouse's citizenship.");
      }
    }
    return { forms, notes, title, caseType };
  }

  if (a.goal === "certificate") {
    caseType = "Citizenship certificate";
    title = "Request a Certificate of Citizenship";
    add("N-600", { recommended: true });
    if (a.military === "yes") notes.push("As a U.S. military member or veteran filing for yourself, your N-600 fee is $0.");
    notes.push("Alternative worth knowing: if you only need to prove citizenship, a U.S. passport is cheaper and often faster than the N-600. The N-600 gives you a permanent Certificate of Citizenship.");
    if (a.parent_usc === "unsure") notes.push("You weren't sure a parent was a citizen. Eligibility for the N-600 depends on that — gather your parent's citizenship documents before filing.");
    return { forms, notes, title, caseType };
  }

  if (a.goal === "replace_card") {
    caseType = "Replace green card";
    title = "Replace or renew your green card";
    add("I-90", { recommended: true });
    add("G-1450", { recommended: true });
    if (a.r90_reason === "error") notes.push("If the error on your card was a USCIS mistake, your filing fee is $0. You still file the I-90 — just don't include payment.");
    if (a.r90_reason === "namechange") notes.push("Because your name changed, include your marriage certificate, divorce decree, or court order as proof.");
    notes.push("You can also file this online at my.uscis.gov, which is usually $50 cheaper. PathFile prepares the paper version you can mail.");
    notes.push("The G-1450 lets you pay the fee by credit card, since USCIS no longer takes checks.");
    return { forms, notes, title, caseType };
  }

  if (a.goal === "remove_conditions") {
    caseType = "Remove conditions (I-751)";
    title = "Remove the conditions on your green card";
    add("I-751", { recommended: true });
    add("G-1450", { recommended: true });
    notes.push("File this during the 90 days BEFORE your 2-year green card expires. Filing too early can get it rejected.");
    if (a.i751_basis === "joint") notes.push("You and your spouse file together and both sign. Include strong proof the marriage is real (joint accounts, lease, children, photos).");
    if (a.i751_basis === "waiver") notes.push("You're filing without your spouse (divorce, abuse, or hardship). These cases are more complex — an attorney review before filing is strongly recommended.");
    return { forms, notes, title, caseType };
  }

  if (a.goal === "fiance") {
    caseType = "Fiancé(e) petition (K-1)";
    title = "Petition for your fiancé(e)";
    add("I-129F", { recommended: true });
    add("G-1450", { recommended: true });
    notes.push("Only a U.S. citizen can file a K-1 fiancé(e) petition. After your fiancé(e) enters on the K-1 visa, you must marry within 90 days.");
    if (a.petitioner_usc === "no") notes.push("Heads up: a green card holder cannot file a K-1 fiancé petition. You would instead marry first, then file an I-130 for your spouse. Switch to 'Help a relative immigrate' for that path.");
    if (a.met_in_person === "no") notes.push("You said you have not met in person in the last 2 years. USCIS requires this unless you qualify for a rare waiver — an attorney should review before filing.");
    notes.push("The G-1450 lets you pay the fee by credit card.");
    return { forms, notes, title, caseType };
  }

  // Family-based green card — petitioner OR beneficiary perspective.
  const petitionerStatus = a.goal === "sponsor" ? a.my_status : a.sponsor_status;
  const relationship = a.relationship;
  const beneficiaryInUS = a.goal === "sponsor" ? a.rel_in_us : a.in_us;
  const lawfulEntry = a.goal === "sponsor" ? a.rel_entry : a.entry;
  const isSpouse = relationship === "spouse";
  const immediate = isImmediateRelative(petitionerStatus, relationship);

  caseType = "Family-based green card";
  title = a.goal === "sponsor" ? "Sponsor your relative for a green card" : "Get your family-based green card";

  // The petition always starts the case.
  add("I-130", { recommended: true });
  if (isSpouse) add("I-130A", { recommended: true });

  const canAdjustNow = immediate && beneficiaryInUS === "yes" && lawfulEntry === "yes";

  if (canAdjustNow) {
    add("I-485", { recommended: true });
    add("I-765", { recommended: false, optional: true });
    add("I-131", { recommended: false, optional: true });
    add("I-864", { recommended: true });
    add("I-693", { recommended: true });
    add("G-1450", { recommended: true });
    notes.push("Because the immigrant is an immediate relative of a U.S. citizen, already in the U.S., and entered lawfully, everything can be filed together in one package (concurrent filing). This is the fastest path.");
    notes.push("The I-765 work permit and I-131 travel document are optional but recommended — they let the immigrant work and travel while the green card is pending, usually at no extra fee when filed with the I-485.");
    notes.push("The I-693 medical exam is done by a USCIS civil surgeon, who seals it. The G-1450 lets you pay all the fees by credit card, since USCIS no longer takes checks.");
  } else {
    if (!immediate) {
      notes.push("This relationship is a 'preference' category, so a visa is not immediately available. File the I-130 now to lock in your place in line (your priority date). The green card forms (I-485, I-864, I-765) come later, once a visa number is available.");
    } else if (beneficiaryInUS !== "yes") {
      notes.push("The immigrant is outside the U.S., so this becomes consular processing. File the I-130 now; the National Visa Center will request the I-864 and arrange an interview abroad later. The I-485 is not used for someone abroad.");
    } else if (lawfulEntry !== "yes") {
      notes.push("Entry was not clearly lawful (inspected & admitted or paroled). Adjusting status inside the U.S. with I-485 may not be available — this is the kind of situation where a licensed immigration attorney's review is strongly advised before filing.");
    }
    notes.push("For now, your package is the I-130" + (isSpouse ? " plus the I-130A." : "."));
  }

  if (a.goal === "selfgc") {
    notes.push("Remember the roles: your sponsor files and signs the I-130 and I-864. You file and sign the I-485 and I-765. Keep the two people's documents clearly separated.");
  }

  return { forms, notes, title, caseType, concurrent: canAdjustNow };
}

/* ---------- Intake field definitions ---------- */
const FIELD = (name, label, opts = {}) => ({ name, label, ...opts });

function intakeSections(result) {
  const codes = result.forms.map((f) => f.code);
  const has = (c) => codes.includes(c);
  const sections = [];

  // The main person whose benefit this is.
  const subjectIsBeneficiary = has("I-485") || has("I-765") || has("I-130A") || (has("I-130") && !has("N-400") && !has("N-600"));
  const subjectLabel = has("N-400") ? "About you (applicant for citizenship)"
    : has("N-600") ? "About the person claiming citizenship"
    : has("I-90") ? "About you (the green card holder)"
    : has("I-751") ? "About you (the conditional resident)"
    : has("I-129F") ? "About you (the U.S. citizen petitioner)"
    : "About the immigrant (beneficiary)";

  sections.push({
    id: "subject",
    title: subjectLabel,
    fields: [
      FIELD("s_last", "Family name (last name)", { req: true }),
      FIELD("s_first", "Given name (first name)", { req: true }),
      FIELD("s_middle", "Middle name"),
      FIELD("s_other", "Other names you've used (maiden, aliases)"),
      FIELD("s_dob", "Date of birth", { type: "date", req: true }),
      FIELD("s_cob", "Country of birth", { req: true }),
      FIELD("s_coc", "Country of citizenship", { req: true }),
      FIELD("s_anum", "A-Number (if any)", { ph: "A-000000000" }),
      FIELD("s_uscis", "USCIS online account number (if any)"),
      FIELD("s_ssn", "U.S. Social Security number (if any)"),
      FIELD("s_street", "Street number and name", { wide: true, req: true }),
      FIELD("s_city", "City or town", { req: true }),
      FIELD("s_state", "State (2-letter)", { ph: "NY" }),
      FIELD("s_zip", "ZIP code"),
      FIELD("s_phone", "Daytime phone"),
      FIELD("s_email", "Email", { type: "email" }),
    ],
  });

  // N-400 needs more about the applicant: sex, resident date, marital, spouse, background.
  if (has("N-400")) {
    sections.push({
      id: "n400",
      title: "More about you (for the citizenship form)",
      fields: [
        FIELD("s_sex", "Sex", { type: "select", options: ["Male", "Female"], req: true }),
        FIELD("s_lprdate", "Date you became a permanent resident", { type: "date", req: true }),
        FIELD("s_marital", "Current marital status", { type: "select", options: ["Single", "Married", "Divorced", "Widowed", "Separated", "Annulled"], req: true }),
        FIELD("sp_first", "Spouse's given name (if married)"),
        FIELD("sp_last", "Spouse's family name (if married)"),
        FIELD("sp_middle", "Spouse's middle name (if married)"),
        FIELD("sp_dob", "Spouse's date of birth (if married)", { type: "date" }),
      ],
    });
    sections.push({
      id: "n400bg",
      title: "Background (answer honestly — these go on the form)",
      note: "Most applicants answer No to the first two and Yes to the oath. If you answer Yes to a crime or removal question, your case should be reviewed by an attorney before filing.",
      fields: [
        FIELD("s_crime", "Have you EVER been arrested, cited, detained, or charged with any crime?", { type: "select", options: ["No", "Yes"], req: true }),
        FIELD("s_removal", "Have you EVER been in removal, deportation, or rescission proceedings?", { type: "select", options: ["No", "Yes"], req: true }),
        FIELD("s_oath", "Are you willing to take the full Oath of Allegiance and its duties (support the Constitution, bear arms or do other service if required by law)?", { type: "select", options: ["Yes", "No"], req: true }),
      ],
    });
  }

  // Entry / status — needed for adjustment + work permit.
  if (has("I-485") || has("I-765")) {
    sections.push({
      id: "entry",
      title: "U.S. entry & current status",
      fields: [
        FIELD("e_lastentry", "Date of last entry into the U.S.", { type: "date" }),
        FIELD("e_place", "Place of last entry (city / port)"),
        FIELD("e_status", "Status at entry (e.g., B-2, F-1, parolee)"),
        FIELD("e_i94", "I-94 number"),
        FIELD("e_passport", "Passport number"),
        FIELD("e_passcountry", "Passport country of issue"),
        FIELD("e_curstatus", "Your current immigration status"),
      ],
    });
  }

  // Repeating history — produces the arrays the filler engine consumes.
  if (has("I-485")) {
    sections.push({
      id: "addrhist",
      title: "Address history (last 5 years)",
      repeating: true,
      arrayKey: "address_history",
      addLabel: "Add another address",
      help: "List everywhere you've lived in the last 5 years, most recent first. The first entry is your current address.",
      entryFields: [
        FIELD("street", "Street number and name", { wide: true }),
        FIELD("apt", "Apt/Ste/Flr number"),
        FIELD("city", "City or town"),
        FIELD("state", "State (2-letter)", { ph: "NY" }),
        FIELD("zip", "ZIP code"),
        FIELD("from", "Lived here from", { type: "date" }),
        FIELD("to", "Lived here until (or type 'present')", { ph: "present" }),
      ],
    });
    sections.push({
      id: "emphist",
      title: "Employment & school history (last 5 years)",
      repeating: true,
      arrayKey: "employment_history",
      addLabel: "Add another employer / school",
      help: "List your jobs and schools for the last 5 years, most recent first. Include gaps (write 'unemployed' as the employer).",
      entryFields: [
        FIELD("employer", "Employer or school name", { wide: true }),
        FIELD("occupation", "Your occupation"),
        FIELD("emp_street", "Employer street number and name", { wide: true }),
        FIELD("emp_apt", "Apt/Ste/Flr number"),
        FIELD("emp_city", "City or town"),
        FIELD("emp_state", "State (2-letter)", { ph: "NY" }),
        FIELD("emp_zip", "ZIP code"),
        FIELD("from", "From", { type: "date" }),
        FIELD("to", "To (or type 'present')", { ph: "present" }),
      ],
    });
  }

  // The petitioner / sponsor (a different person).
  if (has("I-130") || has("I-864")) {
    sections.push({
      id: "petitioner",
      title: "About the sponsor (petitioner) — a different person",
      fields: [
        FIELD("p_last", "Sponsor's family name", { req: true }),
        FIELD("p_first", "Sponsor's given name", { req: true }),
        FIELD("p_status", "Sponsor's status", { type: "select", options: ["U.S. citizen", "Lawful permanent resident"], req: true }),
        FIELD("p_dob", "Sponsor's date of birth", { type: "date" }),
        FIELD("p_anum", "Sponsor's A-Number or certificate number"),
        FIELD("p_ssn", "Sponsor's Social Security number"),
        FIELD("p_street", "Sponsor's street number and name", { wide: true }),
        FIELD("p_city", "Sponsor's city or town"),
        FIELD("p_state", "Sponsor's state (2-letter)", { ph: "NY" }),
        FIELD("p_zip", "Sponsor's ZIP code"),
        FIELD("p_addr_from", "Sponsor living at this address since", { type: "date" }),
        FIELD("p_addr_from", "Sponsor at current address since", { type: "date" }),
        FIELD("p_house", "Sponsor's household size (people supported)", { type: "number" }),
        FIELD("p_income", "Sponsor's most recent annual income (USD)", { type: "number", note: has("I-864") ? "Must usually be at least 125% of the federal poverty guideline for the household size." : "" }),
      ],
    });
  }

  // Sponsor's own history (I-130 requires the petitioner's 5-year history).
  if (has("I-130")) {
    sections.push({
      id: "p_addrhist",
      title: "Sponsor's prior addresses (last 5 years)",
      repeating: true,
      arrayKey: "p_prior_addresses",
      addLabel: "Add another prior address",
      help: "Only the sponsor's PRIOR addresses — the current one is already above. List most recent first.",
      entryFields: [
        FIELD("street", "Street number and name", { wide: true }),
        FIELD("apt", "Apt/Ste/Flr number"),
        FIELD("city", "City or town"),
        FIELD("state", "State (2-letter)", { ph: "NY" }),
        FIELD("zip", "ZIP code"),
        FIELD("from", "Lived here from", { type: "date" }),
        FIELD("to", "Lived here until", { type: "date" }),
      ],
    });
    sections.push({
      id: "p_emphist",
      title: "Sponsor's employment (last 5 years)",
      repeating: true,
      arrayKey: "p_employment_history",
      addLabel: "Add another employer",
      help: "The sponsor's jobs for the last 5 years, most recent first.",
      entryFields: [
        FIELD("employer", "Employer or company name", { wide: true }),
        FIELD("occupation", "Sponsor's occupation"),
        FIELD("emp_street", "Employer street number and name", { wide: true }),
        FIELD("emp_apt", "Apt/Ste/Flr number"),
        FIELD("emp_city", "City or town"),
        FIELD("emp_state", "State (2-letter)", { ph: "NY" }),
        FIELD("emp_zip", "ZIP code"),
        FIELD("from", "From", { type: "date" }),
        FIELD("to", "To (or type 'present')", { ph: "present" }),
      ],
    });
  }

  // Sponsor's own history (I-130 petitioner) — separate p_* arrays.
  if (has("I-130")) {
    sections.push({
      id: "p_addrhist",
      title: "Sponsor's prior addresses (last 5 years)",
      repeating: true,
      arrayKey: "p_prior_addresses",
      addLabel: "Add another prior address",
      help: "If the sponsor has lived at their current address less than 5 years, list earlier addresses here, most recent first. If they've been at the current address 5+ years, leave this blank.",
      entryFields: [
        FIELD("street", "Street number and name", { wide: true }),
        FIELD("apt", "Apt/Ste/Flr number"),
        FIELD("city", "City or town"),
        FIELD("state", "State (2-letter)", { ph: "NY" }),
        FIELD("zip", "ZIP code"),
        FIELD("from", "Lived here from", { type: "date" }),
        FIELD("to", "Lived here until", { type: "date" }),
      ],
    });
    sections.push({
      id: "p_emphist",
      title: "Sponsor's employment (last 5 years)",
      repeating: true,
      arrayKey: "p_employment_history",
      addLabel: "Add another employer",
      help: "List the sponsor's jobs for the last 5 years, most recent first. Write 'unemployed' as the employer for any gaps.",
      entryFields: [
        FIELD("employer", "Employer or company name", { wide: true }),
        FIELD("occupation", "Sponsor's occupation"),
        FIELD("emp_street", "Employer street number and name", { wide: true }),
        FIELD("emp_apt", "Apt/Ste/Flr number"),
        FIELD("emp_city", "City or town"),
        FIELD("emp_state", "State (2-letter)", { ph: "NY" }),
        FIELD("emp_zip", "ZIP code"),
        FIELD("from", "From", { type: "date" }),
        FIELD("to", "To (or type 'present')", { ph: "present" }),
      ],
    });
  }

  // Relationship details.
  if (has("I-130")) {
    sections.push({
      id: "rel",
      title: "The qualifying relationship",
      fields: [
        FIELD("r_type", "Relationship of sponsor to immigrant", { ph: "spouse / parent / child / sibling" }),
        FIELD("r_mdate", "Date of marriage (spouses only)", { type: "date" }),
        FIELD("r_mcity", "City/town of marriage (spouses only)"),
        FIELD("r_mstate", "State of marriage (2-letter, if in U.S.)", { ph: "NY" }),
        FIELD("r_mcountry", "Country of marriage", { ph: "United States" }),
        FIELD("r_prior", "Any prior marriages (either person)?", { type: "select", options: ["No", "Yes — both ended legally"] }),
      ],
    });
  }

  // Naturalization specifics.
  if (has("N-400")) {
    sections.push({
      id: "nat",
      title: "Naturalization details",
      fields: [
        FIELD("n_resident_since", "Permanent resident since (date on green card)", { type: "date" }),
        FIELD("n_basis", "Basis for filing", { type: "select", options: ["5 years as a permanent resident", "3 years married to a U.S. citizen", "Military service"] }),
        FIELD("n_days_outside", "Total days spent outside the U.S. in the last 5 years", { type: "number" }),
      ],
    });
  }

  // Certificate specifics.
  if (has("N-600")) {
    sections.push({
      id: "cert",
      title: "Citizenship-through-parent details",
      fields: [
        FIELD("c_parent_name", "U.S. citizen parent's full name"),
        FIELD("c_parent_basis", "How the parent is a citizen", { type: "select", options: ["Born in the U.S.", "Naturalized", "Citizen at birth abroad"] }),
        FIELD("c_parent_nat_date", "Parent's naturalization date (if any)", { type: "date" }),
        FIELD("c_custody", "Did you live in that parent's legal & physical custody before 18?", { type: "select", options: ["Yes", "No"] }),
      ],
    });
  }

  return sections;
}

/* ---------- Draft form rendering ---------- */
function draftParts(code, d) {
  const subjectName = [d.s_first, d.s_middle, d.s_last].filter(Boolean).join(" ") || "—";
  const sponsorName = [d.p_first, d.p_last].filter(Boolean).join(" ") || "—";
  const V = (x) => (x && String(x).trim() ? String(x) : "— to verify —");
  const addr = [d.s_street, d.s_city, d.s_state, d.s_zip].filter(Boolean).join(", ") || "— to verify —";

  const common = {
    "I-130": [
      ["Part 1 — Relationship", `Petitioner is the ${V(d.r_type)} of the beneficiary.`],
      ["Part 2 — Petitioner (sponsor)", `${V(sponsorName)} • Status: ${V(d.p_status)} • DOB: ${V(d.p_dob)} • A#: ${V(d.p_anum)}`],
      ["Part 4 — Beneficiary (immigrant)", `${V(subjectName)} • DOB: ${V(d.s_dob)} • Country of birth: ${V(d.s_cob)} • A#: ${V(d.s_anum)}`],
      ["Part 5 — Other information", `Marriage: ${V(d.r_mdate)} at ${V(d.r_mplace)} • Prior marriages: ${V(d.r_prior)}`],
    ],
    "I-130A": [
      ["Part 1 — Spouse beneficiary", `${V(subjectName)} • DOB: ${V(d.s_dob)} • Country of citizenship: ${V(d.s_coc)}`],
      ["Part 2 — Address & employment history", `Current address: ${addr} — full 5-year history to be completed on the form.`],
    ],
    "I-485": [
      ["Part 1 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)} • SSN: ${V(d.s_ssn)}`],
      ["Part 1 — Immigration history", `Last entry: ${V(d.e_lastentry)} at ${V(d.e_place)} as ${V(d.e_status)} • I-94: ${V(d.e_i94)}`],
      ["Part 2 — Application type", `Immediate relative of a U.S. citizen (1.a) — based on the filed I-130.`],
      ["Part 3 — Current status", `${V(d.e_curstatus)} • Passport ${V(d.e_passport)} (${V(d.e_passcountry)})`],
    ],
    "I-765": [
      ["Part 1 — Reason", `(c)(9) Adjustment applicant — employment authorization while the I-485 is pending.`],
      ["Part 2 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 2 — Entry", `Last entry ${V(d.e_lastentry)} • I-94 ${V(d.e_i94)} • Status ${V(d.e_curstatus)}`],
    ],
    "I-864": [
      ["Part 1 — Basis", `Sponsor ${V(sponsorName)} is the petitioner who filed the I-130 for ${V(subjectName)}.`],
      ["Part 5 — Household size", `${V(d.p_house)} people`],
      ["Part 6 — Income", `Most recent annual income: $${V(d.p_income)} — must meet 125% of the poverty guideline for the household size.`],
    ],
    "N-400": [
      ["Part 1 — Eligibility basis", `${V(d.n_basis)}`],
      ["Part 1 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 3 — Residence", `Permanent resident since ${V(d.n_resident_since)} • Days outside U.S. (5 yrs): ${V(d.n_days_outside)}`],
      ["Part 4 — Contact", `${addr} • ${V(d.s_phone)} • ${V(d.s_email)}`],
    ],
    "N-600": [
      ["Part 1 — Basis", `Citizenship through parent: ${V(d.c_parent_basis)}`],
      ["Part 2 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • Country of birth: ${V(d.s_cob)}`],
      ["Part 3 — U.S. citizen parent", `${V(d.c_parent_name)} • Naturalized: ${V(d.c_parent_nat_date)} • Custody before 18: ${V(d.c_custody)}`],
    ],
    "I-131": [
      ["Part 2 — Application type", `Advance Parole for an applicant with a pending I-485.`],
      ["Part 3 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 7 — Travel", `Address: ${addr} — list intended travel dates and reason on the form.`],
    ],
    "I-693": [
      ["Completed by the civil surgeon", `Applicant: ${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Do not fill in", `Bring this blank to a USCIS-approved civil surgeon. They complete and seal it.`],
    ],
    "G-1450": [
      ["Cardholder", `${V(d.p_first ? [d.p_first, d.p_last].join(" ") : subjectName)}`],
      ["Amount to authorize", `Total of all paid form fees in this package (enter the exact dollar amount).`],
    ],
    "I-90": [
      ["Part 1 — Applicant", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 2 — Reason for application", `${V(d.r90_reason)} — the specific reason box is marked on the form.`],
      ["Part 3 — Contact & address", `${addr} • ${V(d.s_phone)} • ${V(d.s_email)}`],
    ],
    "I-751": [
      ["Part 1 — Conditional resident", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 2 — Basis", `${V(d.i751_basis)} (joint with spouse, or a waiver).`],
      ["Part 3 — Contact & address", `${addr} • ${V(d.s_phone)} • ${V(d.s_email)}`],
    ],
    "I-129F": [
      ["Part 1 — Petitioner (U.S. citizen)", `${V(subjectName)} • DOB: ${V(d.s_dob)} • A#: ${V(d.s_anum)}`],
      ["Part 2 — Fiancé(e) beneficiary", `Name and details collected — entered on the form.`],
      ["Part 1 — Contact & address", `${addr} • ${V(d.s_phone)} • ${V(d.s_email)}`],
    ],
  };
  return common[code] || [["Part 1", "Information collected — to be mapped onto the official form."]];
}

/* ---------- Assembly, mailing, export helpers ---------- */
function assemblyOrder(result) {
  const priority = ["G-1450", "I-130", "I-130A", "I-485", "I-765", "I-131", "I-864", "I-693", "I-129F", "I-751", "I-90", "N-400", "N-600"];
  const present = result.forms.map((f) => f.code);
  return priority.filter((c) => present.includes(c));
}

function mailingFor(result) {
  const codes = result.forms.map((f) => f.code);
  if (result.concurrent) return MAILING.familyConcurrent;
  if (codes.includes("N-400")) return MAILING["N-400"];
  if (codes.includes("N-600")) return MAILING["N-600"];
  if (codes.includes("I-90")) return MAILING["I-90"];
  if (codes.includes("I-751")) return MAILING["I-751"];
  if (codes.includes("I-129F")) return MAILING["I-129F"];
  return MAILING["I-130"];
}

/* Turn the raw intake + triage answers into the exact shape the filler engine
   reads. Without this the deterministic checkboxes and the EWI/removal/criminal
   backstop never fire, because those depend on derived keys. */
function buildClientData(answers, data, result) {
  const a = answers || {};
  const d = { ...(data || {}) };

  // Petitioner status -> engine flag for the I-130 "U.S. citizen" box
  const status = d.p_status || a.my_status || a.sponsor_status;
  if (status === "U.S. citizen" || status === "USC") d.p_citizen = "us_citizen";
  else if (status === "Lawful permanent resident" || status === "LPR") d.p_citizen = "lpr";

  // Concurrent marriage-based AOS unlocks the I-130/I-485/I-765 deterministic fields
  if (result && result.concurrent && a.relationship === "spouse") d.filing_path = "marriage_aos";

  // Marriage details -> engine keys
  if (d.r_mdate) d.m_date = d.r_mdate;
  if (d.r_mcity) d.m_city = d.r_mcity;
  if (d.r_mstate) d.m_state = d.r_mstate;
  if (d.r_mcountry) d.m_country = d.r_mcountry;

  // I-864 income test inputs
  d.num_immigrants = d.num_immigrants || 1;
  if (d.p_house) d.household_size = Number(d.p_house);

  // Screening flags from triage so the engine backstop matches the app's gate
  const entry = a.entry || a.rel_entry;
  if (entry) d.entry = entry;          // "no"/"unsure" => EWI flag in engine
  if (a.removal) d.removal = a.removal;
  if (a.crim) d.crim = a.crim;

  return d;
}

function exportFilingData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "client_data.json";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- UI ---------- */
const STAGES = ["Triage", "Determination", "Your information", "Draft", "Payment", "Prepared copy"];

function reducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.name]: action.value };
    case "merge":
      return { ...state, ...action.values };
    case "reset":
      return {};
    default:
      return state;
  }
}

export default function App() {
  const [stage, setStage] = useState(0);
  const [answers, dispatch] = useReducer(reducer, {});
  const [data, dataDispatch] = useReducer(reducer, {});
  const [triageStep, setTriageStep] = useState(0);
  const [paid, setPaid] = useState(false);
  const [attorneyRequested, setAttorneyRequested] = useState(false);

  const result = useMemo(() => (answers.goal ? determine(answers) : null), [answers]);
  const sections = useMemo(() => (result ? intakeSections(result) : []), [result]);

  const set = (name, value) => dispatch({ type: "set", name, value });
  const setData = (name, value) => dataDispatch({ type: "set", name, value });

  const restart = () => {
    dispatch({ type: "reset" });
    dataDispatch({ type: "reset" });
    setTriageStep(0);
    setPaid(false);
    setAttorneyRequested(false);
    setStage(0);
  };

  return (
    <div className="pf-root">
      <style>{CSS}</style>
      <style>{`
        .pf-stamp-warn { background:#7a1020; color:#fff; }
        .pf-referral { margin-top:18px; padding:16px; border:2px solid #7a1020;
          border-radius:10px; background:#fbeef0; }
        .pf-referral .pf-btn-primary { margin-top:10px; }
        .pf-repeat { display:flex; flex-direction:column; gap:14px; }
        .pf-entry { border:1px solid #d8d8de; border-radius:10px; padding:14px;
          background:#fafafb; }
        .pf-entry-head { display:flex; justify-content:space-between; align-items:center;
          margin-bottom:8px; }
        .pf-entry-num { font-weight:600; font-size:0.82rem; letter-spacing:.04em;
          text-transform:uppercase; color:#555; }
        .pf-history { margin-top:20px; padding:16px; border:1px solid #d8d8de;
          border-radius:10px; background:#f7f9fc; }
        .pf-histgroup { margin-top:10px; }
        .pf-histtitle { font-weight:600; font-size:0.9rem; margin-bottom:4px; }
        .pf-histlist { margin:0; padding-left:20px; font-size:0.9rem; color:#333; }
        .pf-histlist li { margin:2px 0; }
        .pf-getbox { margin:18px 0 4px; padding:16px 18px; border:1px solid #cfe0d8;
          border-radius:12px; background:#f0f7f3; }
        .pf-getbox-title { font-weight:700; font-size:0.95rem; margin-bottom:8px; color:#15514e; }
        .pf-getlist { margin:0; padding-left:20px; }
        .pf-getlist li { margin:6px 0; font-size:0.92rem; line-height:1.45; }
        .pf-getbox-fine { margin-top:10px; font-size:0.82rem; color:#5c6b66; }
        .pf-getlist-pay { margin-top:12px; }
        .pf-getlist-pay li { font-size:0.9rem; }
        .pf-intro { margin:0 0 22px; padding:18px 20px; border:1px solid #cfe0d8;
          border-radius:12px; background:#eef6f1; }
        .pf-intro-title { font-family:'Bricolage Grotesque',sans-serif; font-weight:800;
          font-size:1.15rem; color:#0e3a38; margin-bottom:4px; }
        .pf-intro-lead { margin:0 0 8px; font-size:0.95rem; color:#16282b; }
        .pf-intro-steps { margin:0 0 10px; padding-left:22px; }
        .pf-intro-steps li { margin:6px 0; font-size:0.92rem; line-height:1.45; }
        .pf-intro-foot { margin:0; font-size:0.92rem; line-height:1.5; color:#16282b;
          padding-top:10px; border-top:1px solid #cfe0d8; }
      `}</style>

      <header className="pf-top">
        <div className="pf-brand">
          <span className="pf-seal" aria-hidden>★</span>
          <div>
            <div className="pf-brandname">PathFile</div>
            <div className="pf-brandsub">Immigration form assistant</div>
          </div>
        </div>
        <div className="pf-caseref">CASE&nbsp;·&nbsp;{caseRef(answers)}</div>
      </header>

      <div className="pf-shell">
        <nav className="pf-rail" aria-label="Progress">
          {STAGES.map((s, i) => (
            <button
              key={s}
              className={"pf-stage" + (i === stage ? " is-active" : "") + (i < stage ? " is-done" : "")}
              onClick={() => i <= stage && setStage(i)}
              disabled={i > stage}
            >
              <span className="pf-stagenum">{i < stage ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <span className="pf-stagelabel">{s}</span>
            </button>
          ))}
          <div className="pf-disclaimer">
            Not legal advice. Confirm fees and mailing addresses at <strong>uscis.gov</strong> before filing. For complex cases, consult a licensed immigration attorney.
          </div>
        </nav>

        <main className="pf-main">
          {stage === 0 && (
            <Triage
              answers={answers}
              set={set}
              step={triageStep}
              setStep={setTriageStep}
              onDone={() => setStage(1)}
            />
          )}
          {stage === 1 && result && !attorneyRequested && (
            <Determination
              result={result}
              onNext={() => setStage(2)}
              onBack={() => setStage(0)}
              onConsult={() => setAttorneyRequested(true)}
            />
          )}
          {stage === 1 && result && attorneyRequested && (
            <section className="pf-card">
              <div className="pf-stamp pf-stamp-warn">
                <div className="pf-stamp-line">REQUEST SENT</div>
                <div className="pf-stamp-type">Attorney review</div>
              </div>
              <h1 className="pf-h1">Your request is in.</h1>
              <p className="pf-lead">
                A licensed immigration attorney will review your situation and follow up.
                No forms are prepared or filed until they confirm the right path.
              </p>
              {/* TODO: connect this to your existing attorney-review intake / checkout. */}
              <div className="pf-actions">
                <button className="pf-btn pf-btn-ghost" onClick={() => { setAttorneyRequested(false); setStage(0); }}>
                  ← Start over
                </button>
              </div>
            </section>
          )}
          {stage === 2 && result && (
            <Intake
              sections={sections}
              data={data}
              setData={setData}
              onNext={() => setStage(3)}
              onBack={() => setStage(1)}
            />
          )}
          {stage === 3 && result && (
            <Draft result={result} data={data} answers={answers} paid={false} onNext={() => setStage(4)} onBack={() => setStage(2)} />
          )}
          {stage === 4 && result && (
            <Payment result={result} onPaid={() => { setPaid(true); setStage(5); }} onBack={() => setStage(3)} />
          )}
          {stage === 5 && result && (
            <Draft result={result} data={data} answers={answers} paid={true} final onBack={() => setStage(4)} onRestart={restart} />
          )}
        </main>
      </div>
    </div>
  );
}

function caseRef(a) {
  const seed = (a.goal || "new").toUpperCase().slice(0, 3);
  return `PF-${seed}-2026`;
}

/* ---------- Triage ---------- */
function Triage({ answers, set, step, setStep, onDone }) {
  // Build a flat ordered list of questions based on the chosen goal.
  const qs = triageQuestions(answers);
  const current = qs[step];

  const choose = (q, val) => {
    set(q.name, val);
    // If this answer changes the branch, trim forward answers by recomputing next.
    const nextStep = step + 1;
    const nextQs = triageQuestions({ ...answers, [q.name]: val });
    if (nextStep >= nextQs.length) {
      onDone();
    } else {
      setStep(nextStep);
    }
  };

  return (
    <section className="pf-card pf-triage">
      {step === 0 && (
        <div className="pf-intro">
          <div className="pf-intro-title">Here's what PathFile does for you</div>
          <p className="pf-intro-lead">Answer a few simple questions. We do the rest:</p>
          <ol className="pf-intro-steps">
            <li><strong>Picks the right forms.</strong> We figure out exactly which USCIS forms your situation needs.</li>
            <li><strong>Fills them out.</strong> Your answers go onto the real forms — completed and ready.</li>
            <li><strong>Tells you what to include.</strong> A checklist of the exact evidence to attach.</li>
            <li><strong>Tells you where to mail it</strong> and how to pay the USCIS fee.</li>
          </ol>
          <p className="pf-intro-foot">You get your completed documents plus a one-page instruction sheet. All you do is <strong>print, sign, attach your evidence, and mail it with payment.</strong></p>
        </div>
      )}
      <div className="pf-eyebrow">Step {step + 1} of {Math.max(qs.length, 1)} · Triage</div>
      <h1 className="pf-h1">{current.q}</h1>
      {current.help && <p className="pf-help">{current.help}</p>}

      <div className="pf-options">
        {current.options.map((opt) => (
          <button
            key={opt.id}
            className={"pf-option" + (answers[current.name] === opt.id ? " is-chosen" : "")}
            onClick={() => choose(current, opt.id)}
          >
            <span className="pf-optlabel">{opt.label}</span>
            {opt.sub && <span className="pf-optsub">{opt.sub}</span>}
            <span className="pf-optarrow" aria-hidden>→</span>
          </button>
        ))}
      </div>

      {step > 0 && (
        <button className="pf-textbtn" onClick={() => setStep(step - 1)}>← Back a question</button>
      )}
    </section>
  );
}

function triageQuestions(a) {
  const qs = [
    {
      name: "goal",
      q: "What do you want to do?",
      help: "Pick the goal that fits best. We'll figure out exactly which forms that requires.",
      options: GOALS,
    },
  ];

  if (a.goal === "naturalize") {
    qs.push({
      name: "derived_already",
      q: "Did you automatically become a citizen when a parent naturalized before you turned 18 — while you were a green card holder?",
      help: "This matters a lot. If yes, you may already be a citizen and should request a certificate instead of naturalizing.",
      options: [
        { id: "no", label: "No / that doesn't apply to me" },
        { id: "yes", label: "Yes, a parent naturalized before I was 18" },
        { id: "unsure", label: "I'm not sure" },
      ],
    });
    if (a.derived_already !== "yes") {
      qs.push({
        name: "lpr_years",
        q: "How long have you held a green card?",
        options: [
          { id: "5", label: "5 years or more" },
          { id: "3", label: "3 to 5 years" },
          { id: "lt3", label: "Less than 3 years" },
        ],
      });
      qs.push({
        name: "married_usc",
        q: "Are you married to, and living with, a U.S. citizen for the last 3 years?",
        help: "This unlocks the shorter 3-year residence rule.",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
      });
    }
    qs.push({
      name: "crim",
      q: "Since getting your green card, have you been arrested, charged, or convicted of any crime, or had any immigration problems?",
      help: "Applying to naturalize with certain records can put you into removal. If yes, an attorney should review before you file.",
      options: [
        { id: "no", label: "No" },
        { id: "yes", label: "Yes" },
        { id: "unsure", label: "I'm not sure" },
      ],
    });
  }

  if (a.goal === "certificate") {
    qs.push({
      name: "parent_usc",
      q: "Was at least one parent a U.S. citizen at your birth, or did a parent naturalize before you turned 18?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
        { id: "unsure", label: "I'm not sure" },
      ],
    });
    qs.push({
      name: "military",
      q: "Are you a current or former U.S. military member filing for yourself?",
      help: "If yes, your filing fee is $0.",
      options: [
        { id: "no", label: "No" },
        { id: "yes", label: "Yes" },
      ],
    });
  }

  if (a.goal === "replace_card") {
    qs.push({
      name: "r90_reason",
      q: "Why do you need a new green card?",
      help: "This sets the right reason on the form and tells you if your fee is $0.",
      options: [
        { id: "expired", label: "It expired or expires soon" },
        { id: "lost", label: "Lost, stolen, or damaged" },
        { id: "namechange", label: "My name changed" },
        { id: "error", label: "It has an error USCIS made" },
      ],
    });
  }

  if (a.goal === "remove_conditions") {
    qs.push({
      name: "i751_basis",
      q: "Are you filing together with the spouse who sponsored you?",
      help: "A 2-year card comes from a recent marriage. How you file changes what's required.",
      options: [
        { id: "joint", label: "Yes — filing jointly with my spouse" },
        { id: "waiver", label: "No — divorced, abuse, or hardship (waiver)" },
      ],
    });
    qs.push({
      name: "crim",
      q: "Since getting your green card, have you been arrested, charged, or convicted of any crime?",
      help: "Some records can affect this case. If yes, an attorney should review before you file.",
      options: [
        { id: "no", label: "No" },
        { id: "yes", label: "Yes" },
        { id: "unsure", label: "I'm not sure" },
      ],
    });
  }

  if (a.goal === "fiance") {
    qs.push({
      name: "petitioner_usc",
      q: "Are you a U.S. citizen?",
      help: "Only a U.S. citizen can file a K-1 fiancé(e) petition.",
      options: [
        { id: "yes", label: "Yes, I'm a U.S. citizen" },
        { id: "no", label: "No, I'm a green card holder" },
      ],
    });
    qs.push({
      name: "met_in_person",
      q: "Have you and your fiancé(e) met in person within the last 2 years?",
      help: "USCIS requires this for almost all K-1 cases.",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    });
    qs.push({
      name: "crim",
      q: "Has either of you ever been arrested, charged, or convicted of any crime?",
      help: "Certain records affect K-1 eligibility. If yes, an attorney should review first.",
      options: [
        { id: "no", label: "No" },
        { id: "yes", label: "Yes" },
        { id: "unsure", label: "I'm not sure" },
      ],
    });
  }

  if (a.goal === "sponsor") {
    qs.push({
      name: "my_status",
      q: "What is your status? (You are the sponsor.)",
      options: [
        { id: "USC", label: "U.S. citizen" },
        { id: "LPR", label: "Green card holder (permanent resident)" },
      ],
    });
    qs.push({
      name: "relationship",
      q: "How is your relative related to you?",
      help: "Be precise — this decides whether a visa is available right away.",
      options: relationshipOptions(a.my_status),
    });
    qs.push({
      name: "rel_in_us",
      q: "Where does your relative live right now?",
      options: [
        { id: "yes", label: "Inside the United States" },
        { id: "no", label: "Outside the United States" },
      ],
    });
    if (a.rel_in_us === "yes") {
      qs.push({
        name: "rel_entry",
        q: "Did your relative enter the U.S. lawfully — inspected and admitted, or paroled?",
        help: "This determines whether they can get the green card without leaving the country.",
        options: [
          { id: "yes", label: "Yes, entered lawfully" },
          { id: "no", label: "No / entered without inspection" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
      qs.push({
        name: "removal",
        q: "Has your relative ever been ordered removed or deported, or are they currently in immigration court (removal proceedings)?",
        help: "If so, the case can't simply be filed — it needs an attorney first.",
        options: [
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
      qs.push({
        name: "crim",
        q: "Has your relative ever been arrested, charged, or convicted of any crime, anywhere?",
        help: "Even old, minor, or dismissed cases can affect eligibility. If yes, an attorney should review before filing.",
        options: [
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
    }
  }

  if (a.goal === "selfgc") {
    qs.push({
      name: "sponsor_status",
      q: "Who will sponsor you?",
      help: "You are the immigrant. This is about the relative filing for you.",
      options: [
        { id: "USC", label: "A U.S. citizen relative" },
        { id: "LPR", label: "A green card holder relative" },
      ],
    });
    qs.push({
      name: "relationship",
      q: "How is that sponsor related to you?",
      options: relationshipOptions(a.sponsor_status),
    });
    qs.push({
      name: "in_us",
      q: "Are you currently inside the United States?",
      options: [
        { id: "yes", label: "Yes, I'm in the U.S." },
        { id: "no", label: "No, I'm abroad" },
      ],
    });
    if (a.in_us === "yes") {
      qs.push({
        name: "entry",
        q: "Did you enter the U.S. lawfully — inspected and admitted, or paroled?",
        options: [
          { id: "yes", label: "Yes, entered lawfully" },
          { id: "no", label: "No / entered without inspection" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
      qs.push({
        name: "removal",
        q: "Have you ever been ordered removed or deported, or are you currently in immigration court (removal proceedings)?",
        help: "If so, your case can't simply be filed — it needs an attorney first.",
        options: [
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
      qs.push({
        name: "crim",
        q: "Have you ever been arrested, charged, or convicted of any crime, anywhere?",
        help: "Even old, minor, or dismissed cases can affect eligibility. If yes, an attorney should review before filing.",
        options: [
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
          { id: "unsure", label: "I'm not sure" },
        ],
      });
    }
  }

  return qs;
}

function relationshipOptions(status) {
  if (status === "LPR") {
    return [
      { id: "spouse", label: "Spouse", sub: "Husband or wife" },
      { id: "child_u21", label: "Unmarried child under 21" },
      { id: "child_adult", label: "Unmarried son or daughter 21+" },
    ];
  }
  // USC (default)
  return [
    { id: "spouse", label: "Spouse", sub: "Husband or wife" },
    { id: "parent", label: "Parent", sub: "You/the citizen must be 21+" },
    { id: "child_u21", label: "Unmarried child under 21" },
    { id: "child_adult", label: "Son or daughter 21+, or married" },
    { id: "sibling", label: "Brother or sister", sub: "Citizen must be 21+" },
  ];
}

/* ---------- Determination ---------- */
function Determination({ result, onNext, onBack, onConsult }) {
  // Hard referral: do not show a package or a path to payment.
  if (result.refer) {
    return (
      <section className="pf-card">
        <div className="pf-stamp pf-stamp-warn">
          <div className="pf-stamp-line">CASE FLAGGED</div>
          <div className="pf-stamp-type">{result.caseType}</div>
        </div>

        <div className="pf-eyebrow">Determination</div>
        <h1 className="pf-h1">{result.title}</h1>

        <p className="pf-lead">
          Based on your answers, this case is not a fit for self-preparation. Filing the
          standard forms could be a waste of the government fee — or could create a real
          risk. We're not going to sell you a package that might not be fileable. Here's why:
        </p>

        <div className="pf-notes">
          <div className="pf-notes-title">Why an attorney first</div>
          {result.reasons.map((r) => (
            <p key={r} className="pf-noteitem">{REFERRAL_TEXT[r]}</p>
          ))}
        </div>

        <div className="pf-referral">
          <div className="pf-notes-title">What happens next</div>
          <p className="pf-noteitem">
            A licensed immigration attorney reviews your situation before any form is
            prepared or filed. Nothing is filed with USCIS until they confirm the right path.
          </p>
          <button className="pf-btn pf-btn-primary" onClick={onConsult}>
            Request attorney review →
          </button>
        </div>

        <div className="pf-actions">
          <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Change my answers</button>
        </div>
      </section>
    );
  }

  const totalUSCIS = result.forms.reduce((sum, f) => {
    const fee = FEES[f.code];
    const amt = fee ? (fee.paper ?? 0) : 0;
    return sum + amt;
  }, 0);

  return (
    <section className="pf-card">
      <div className="pf-stamp">
        <div className="pf-stamp-line">FILING DETERMINATION</div>
        <div className="pf-stamp-type">{result.caseType}</div>
      </div>

      <div className="pf-eyebrow">Determination</div>
      <h1 className="pf-h1">{result.title}</h1>

      <p className="pf-lead">Based on your answers, here is the package to prepare. Roles matter — note who signs each form.</p>

      <div className="pf-getbox">
        <div className="pf-getbox-title">What you get after you pay</div>
        <ul className="pf-getlist">
          <li><strong>Your forms, filled out.</strong> We put your answers onto the real USCIS forms and give you the PDFs to download.</li>
          <li><strong>Simple instructions.</strong> Who signs each form, in what order to stack them, and how to put the packet together.</li>
          <li><strong>An evidence checklist.</strong> The exact papers to include with each form so it doesn't get rejected.</li>
          <li><strong>Where to mail it.</strong> The mailing address for your packet, plus the official page to double-check it.</li>
        </ul>
        <div className="pf-getbox-fine">You see a free preview first. You only pay to unlock the clean, ready-to-mail copies.</div>
      </div>

      <div className="pf-forms">
        {result.forms.map((f) => {
          const meta = FORM_META[f.code];
          const fee = FEES[f.code];
          return (
            <div key={f.code} className="pf-form">
              <div className="pf-form-head">
                <span className="pf-form-code">{f.code}</span>
                <div className="pf-form-titles">
                  <div className="pf-form-title">{meta.title}</div>
                  <div className="pf-form-who">Filed by: {meta.who}</div>
                </div>
                <div className="pf-form-fee">
                  {fee.paper === 0 ? "No fee" : `$${fee.paper.toLocaleString()}`}
                  {fee.online && fee.online !== fee.paper && (
                    <span className="pf-form-feealt">${fee.online.toLocaleString()} online</span>
                  )}
                </div>
              </div>
              {f.optional && <span className="pf-badge pf-badge-opt">Optional but recommended</span>}
              {fee.note && <p className="pf-form-note">{fee.note}</p>}
            </div>
          );
        })}
      </div>

      <div className="pf-feeline">
        <span>Estimated USCIS fees (paper)</span>
        <strong>${totalUSCIS.toLocaleString()}</strong>
      </div>
      <p className="pf-finefee">
        Fees are paid to USCIS, not to PathFile. As of October 2025, USCIS no longer accepts checks
        or money orders — pay with Form G-1450 (credit card) or G-1650 (bank debit).
      </p>

      {result.notes.length > 0 && (
        <div className="pf-notes">
          <div className="pf-notes-title">What to know</div>
          {result.notes.map((n, i) => (
            <p key={i} className="pf-noteitem">{n}</p>
          ))}
        </div>
      )}

      <div className="pf-evidence">
        <div className="pf-notes-title">Evidence to gather &amp; where to file</div>
        {result.forms.map((f) => (
          <details key={f.code} className="pf-detail">
            <summary>
              <span className="pf-detail-code">{f.code}</span> evidence checklist
            </summary>
            <ul className="pf-checklist">
              {EVIDENCE[f.code].map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <div className="pf-where">
              Where to file:{" "}
              {result.concurrent && ["I-485", "I-765", "I-864", "I-130", "I-130A"].includes(f.code) ? (
                <span>Mail the whole package together to the I-485 lockbox for your state of residence. Confirm the exact address at <a href={WHERE_TO_FILE["I-485"]} target="_blank" rel="noreferrer">uscis.gov/i-485</a>.</span>
              ) : (
                <span>The address depends on your state and category — confirm it at <a href={WHERE_TO_FILE[f.code]} target="_blank" rel="noreferrer">{WHERE_TO_FILE[f.code].replace("https://www.", "")}</a>.</span>
              )}
            </div>
          </details>
        ))}
      </div>

      <div className="pf-actions">
        <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Change my answers</button>
        <button className="pf-btn pf-btn-primary" onClick={onNext}>Enter my information →</button>
      </div>
    </section>
  );
}

/* ---------- Intake ---------- */
function Intake({ sections, data, setData, onNext, onBack }) {
  const [idx, setIdx] = useState(0);
  const section = sections[idx];
  const last = idx === sections.length - 1;

  const missingReq = section.repeating ? [] : section.fields.filter((f) => f.req && !data[f.name]);

  const arrayKey = section.arrayKey;
  const baseArr = () => (data[arrayKey] && data[arrayKey].length ? data[arrayKey] : [{}]);
  const entries = section.repeating ? baseArr() : null;
  const updateEntry = (ei, name, val) =>
    setData(arrayKey, baseArr().map((e, i) => (i === ei ? { ...e, [name]: val } : e)));
  const addEntry = () => setData(arrayKey, [...baseArr(), {}]);
  const removeEntry = (ei) => {
    const next = baseArr().filter((_, i) => i !== ei);
    setData(arrayKey, next.length ? next : [{}]);
  };

  return (
    <section className="pf-card">
      <div className="pf-eyebrow">Your information · part {idx + 1} of {sections.length}</div>
      <h1 className="pf-h1">{section.title}</h1>
      <p className="pf-help">{section.help || "Type once — we map your answers onto every form in your package. Leave blank anything you don't have yet."}</p>

      {section.repeating ? (
        <div className="pf-repeat">
          {entries.map((entry, ei) => (
            <div key={ei} className="pf-entry">
              <div className="pf-entry-head">
                <span className="pf-entry-num">{ei === 0 ? "Most recent" : "Entry #" + (ei + 1)}</span>
                {entries.length > 1 && (
                  <button className="pf-textbtn" onClick={() => removeEntry(ei)}>Remove</button>
                )}
              </div>
              <div className="pf-fields">
                {section.entryFields.map((f) => (
                  <label key={f.name} className={"pf-field" + (f.wide ? " pf-field-wide" : "")}>
                    <span className="pf-label">{f.label}</span>
                    <input
                      className="pf-input"
                      type={f.type || "text"}
                      placeholder={f.ph || ""}
                      value={entry[f.name] || ""}
                      onChange={(e) => updateEntry(ei, f.name, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="pf-btn pf-btn-ghost" onClick={addEntry}>+ {section.addLabel}</button>
        </div>
      ) : (
        <div className="pf-fields">
          {section.fields.map((f) => (
            <label key={f.name} className={"pf-field" + (f.wide ? " pf-field-wide" : "")}>
              <span className="pf-label">
                {f.label}
                {f.req && <span className="pf-req"> *</span>}
              </span>
              {f.type === "select" ? (
                <select className="pf-input" value={data[f.name] || ""} onChange={(e) => setData(f.name, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="pf-input"
                  type={f.type || "text"}
                  placeholder={f.ph || ""}
                  value={data[f.name] || ""}
                  onChange={(e) => setData(f.name, e.target.value)}
                />
              )}
              {f.note && <span className="pf-fieldnote">{f.note}</span>}
            </label>
          ))}
        </div>
      )}

      <div className="pf-actions">
        {idx > 0 ? (
          <button className="pf-btn pf-btn-ghost" onClick={() => setIdx(idx - 1)}>← Previous</button>
        ) : (
          <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Determination</button>
        )}
        {last ? (
          <button className="pf-btn pf-btn-primary" onClick={onNext} disabled={missingReq.length > 0}>
            Review my draft →
          </button>
        ) : (
          <button className="pf-btn pf-btn-primary" onClick={() => setIdx(idx + 1)} disabled={missingReq.length > 0}>
            Next section →
          </button>
        )}
      </div>
      {missingReq.length > 0 && (
        <p className="pf-warn">Fill the required fields (*) to continue: {missingReq.map((f) => f.label).join(", ")}.</p>
      )}
    </section>
  );
}

/* ---------- Draft / Final ---------- */
function HistoryReview({ data }) {
  const dateRange = (e) => {
    const f = e.from || "";
    const t = e.to && /present|current|now/i.test(e.to) ? "present" : (e.to || "");
    return f || t ? ` (${f || "?"} – ${t || "?"})` : "";
  };
  const mkAddr = (a) => {
    const c = [a.street, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return c ? c + dateRange(a) : "";
  };
  const mkJob = (e) => {
    const c = [e.employer, e.occupation].filter(Boolean).join(" — ");
    return c ? c + dateRange(e) : "";
  };
  const groups = [
    { title: "Your address history", items: (data.address_history || []).map(mkAddr).filter(Boolean) },
    { title: "Your employment & school history", items: (data.employment_history || []).map(mkJob).filter(Boolean) },
    { title: "Sponsor's prior addresses", items: (data.p_prior_addresses || []).map(mkAddr).filter(Boolean) },
    { title: "Sponsor's employment", items: (data.p_employment_history || []).map(mkJob).filter(Boolean) },
  ].filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <div className="pf-history">
      <div className="pf-notes-title">History captured — this fills the address &amp; employment sections</div>
      {groups.map((g) => (
        <div key={g.title} className="pf-histgroup">
          <div className="pf-histtitle">{g.title}</div>
          <ol className="pf-histlist">
            {g.items.map((it, i) => <li key={i}>{it}</li>)}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Draft({ result, data, answers, paid, final, onNext, onBack, onRestart }) {
  const [fillStatus, setFillStatus] = useState("");
  return (
    <section className="pf-card">
      <div className="pf-eyebrow">{final ? "Prepared copy" : "Draft preview"}</div>
      <h1 className="pf-h1">{final ? "Your prepared package" : "Review your draft forms"}</h1>
      <p className="pf-help">
        {final
          ? "These are your prepared drafts. Transfer each answer onto the official USCIS form, attach the evidence, sign, and mail."
          : "This is a watermarked draft so you can check every answer. Unlock the clean prepared copy after payment."}
      </p>

      <div className="pf-draftstack">
        {result.forms.map((f) => (
          <article key={f.code} className={"pf-draftdoc" + (paid ? "" : " is-draft")}>
            {!paid && <div className="pf-watermark">DRAFT</div>}
            <header className="pf-draftdoc-head">
              <div>
                <div className="pf-draftdoc-code">Form {f.code}</div>
                <div className="pf-draftdoc-title">{FORM_META[f.code].title}</div>
              </div>
              <div className="pf-draftdoc-who">{FORM_META[f.code].who}</div>
            </header>
            <dl className="pf-draftparts">
              {draftParts(f.code, data).map(([part, val], i) => (
                <div key={i} className="pf-draftpart">
                  <dt>{part}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <HistoryReview data={data} />

      {final ? (
        <>
          <div className="pf-assembly">
            <div className="pf-notes-title">Sign, assemble &amp; mail</div>

            <div className="pf-asmblock">
              <div className="pf-asmlabel">1 · Sign each form — the right person, in black ink</div>
              {result.forms.map((f) => {
                const s = SIGN_INFO[f.code];
                return (
                  <div key={f.code} className="pf-signrow">
                    <span className="pf-signcode">{f.code}</span>
                    <span className="pf-signtext">
                      <strong>{s.part}</strong> — signed by {s.who}. {s.note}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pf-asmblock">
              <div className="pf-asmlabel">2 · Stack the package in this order</div>
              <ol className="pf-order">
                {assemblyOrder(result).map((c) => (
                  <li key={c}>
                    <span className="pf-signcode">{c}</span> {FORM_META[c].title}
                    {EVIDENCE[c] && <span className="pf-orderev"> — attach: {EVIDENCE[c][0].toLowerCase()}…</span>}
                  </li>
                ))}
              </ol>
            </div>

            <div className="pf-asmblock">
              <div className="pf-asmlabel">3 · Mail to this address</div>
              {(() => {
                const m = mailingFor(result);
                return (
                  <div className="pf-mailbox">
                    <div className="pf-mailtitle">{m.label}</div>
                    <p className="pf-mailbody">{m.body}</p>
                    {m.usps && <div className="pf-mailaddr"><span>By USPS</span>{m.usps}</div>}
                    {m.courier && <div className="pf-mailaddr"><span>By courier</span>{m.courier}</div>}
                    <p className="pf-mailnote"><strong>Important:</strong> Where you mail this often depends on your home address. Confirm the correct mailing address for your state at <strong>uscis.gov</strong> before you send your package — the wrong address can get it rejected.</p>
                    <p className="pf-mailverify">{m.verify} <a href={m.url} target="_blank" rel="noreferrer">Open the official address page →</a></p>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="pf-finalnote">
            PathFile fills and organizes your forms. It does not submit anything to the
            government. Download your completed package below, then print, sign, attach your
            evidence, and mail it with payment.
          </div>
          <div className="pf-actions">
            <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Back</button>
            <button className="pf-btn pf-btn-primary" onClick={() => downloadCompletedPackage(buildClientData(answers, data, result), result, data, setFillStatus)}>⤓ Download my completed package (PDF)</button>
            <button className="pf-btn pf-btn-ghost" onClick={() => window.print()}>Print instructions</button>
            <button className="pf-btn pf-btn-ghost" onClick={onRestart}>Start a new case</button>
          </div>
          {fillStatus && <p className="pf-help" style={{ marginTop: 8, fontWeight: 600 }}>{fillStatus}</p>}
        </>
      ) : (
        <div className="pf-actions">
          <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Edit my information</button>
          <button className="pf-btn pf-btn-primary" onClick={onNext}>Unlock final copy →</button>
        </div>
      )}
    </section>
  );
}

/* ---------- Payment ---------- */
function Payment({ result, onPaid, onBack }) {
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const formCount = result.forms.length;
  const price = 49 + (formCount - 1) * 20; // demo pricing: $49 base + $20 per extra form

  const pay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onPaid();
    }, 900);
  };

  const valid = num.replace(/\s/g, "").length >= 12 && name.trim().length > 1;

  return (
    <section className="pf-card pf-pay">
      <div className="pf-eyebrow">Payment</div>
      <h1 className="pf-h1">Unlock your prepared copy</h1>

      <div className="pf-receipt">
        <div className="pf-receipt-row">
          <span>Preparation service — {formCount}-form package</span>
          <strong>${price}</strong>
        </div>
        <div className="pf-receipt-fine">
          This is PathFile's preparation fee only. Government filing fees are paid separately to USCIS
          when you mail your package.
        </div>
        <ul className="pf-getlist pf-getlist-pay">
          <li>Your forms, filled out and ready to download</li>
          <li>Step-by-step instructions on signing and assembling</li>
          <li>A checklist of evidence to include</li>
          <li>The address to mail your packet to</li>
        </ul>
      </div>

      <div className="pf-fields">
        <label className="pf-field pf-field-wide">
          <span className="pf-label">Name on card</span>
          <input className="pf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </label>
        <label className="pf-field pf-field-wide">
          <span className="pf-label">Card number</span>
          <input className="pf-input" value={num} onChange={(e) => setNum(e.target.value)} placeholder="0000 0000 0000 0000" inputMode="numeric" />
        </label>
      </div>

      <div className="pf-actions">
        <button className="pf-btn pf-btn-ghost" onClick={onBack}>← Back to draft</button>
        <button className="pf-btn pf-btn-ghost" onClick={onPaid} title="Demo only — bypasses payment">Skip payment (demo)</button>
        <button className="pf-btn pf-btn-primary" onClick={pay} disabled={!valid || processing}>
          {processing ? "Processing…" : `Pay $${price} & unlock`}
        </button>
      </div>
      <p className="pf-warn">Demo only — no real charge is made and nothing is submitted to any agency.</p>
    </section>
  );
}

/* ---------- Styles ---------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Spline+Sans+Mono:wght@400;500;600&display=swap');

.pf-root{
  --ink:#16282b; --paper:#f5f1e8; --panel:#fffdf8; --seal:#15514e; --seal-d:#0e3a38;
  --bronze:#b1702a; --sky:#2f6a86; --line:#ddd5c4; --muted:#5c6b66; --warn:#9a3b1f;
  --ok:#2f6f4f;
  font-family:'Public Sans',system-ui,sans-serif; color:var(--ink);
  background:var(--paper); min-height:100vh;
}
.pf-root *{box-sizing:border-box;}
.pf-root a{color:var(--sky);}

.pf-top{
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 28px; border-bottom:1px solid var(--line);
  background:var(--seal); color:#f3efe4;
}
.pf-brand{display:flex; align-items:center; gap:13px;}
.pf-seal{
  display:grid; place-items:center; width:38px; height:38px; border-radius:50%;
  border:2px solid #d8b27a; color:#e8c894; font-size:18px;
}
.pf-brandname{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:21px; letter-spacing:-.02em; line-height:1;}
.pf-brandsub{font-size:12px; color:#bcd0cb; letter-spacing:.04em; text-transform:uppercase; margin-top:3px;}
.pf-caseref{font-family:'Spline Sans Mono',monospace; font-size:12px; color:#bcd0cb; letter-spacing:.02em;}

.pf-shell{display:flex; gap:0; max-width:1180px; margin:0 auto; padding:0;}
.pf-rail{
  width:236px; flex:none; padding:30px 22px; border-right:1px solid var(--line);
  position:sticky; top:0; align-self:flex-start;
}
.pf-stage{
  display:flex; align-items:center; gap:12px; width:100%; text-align:left;
  background:none; border:none; padding:11px 10px; border-radius:9px; cursor:pointer;
  color:var(--muted); font-size:14.5px; font-family:inherit; margin-bottom:2px;
}
.pf-stage:disabled{cursor:default; opacity:.55;}
.pf-stage.is-active{background:var(--panel); color:var(--ink); box-shadow:inset 0 0 0 1px var(--line);}
.pf-stage.is-done{color:var(--seal);}
.pf-stagenum{
  font-family:'Spline Sans Mono',monospace; font-size:12px; width:24px; height:24px;
  display:grid; place-items:center; border-radius:6px; background:var(--paper);
  box-shadow:inset 0 0 0 1px var(--line); flex:none;
}
.pf-stage.is-active .pf-stagenum{background:var(--seal); color:#fff;}
.pf-stage.is-done .pf-stagenum{background:var(--ok); color:#fff;}
.pf-stagelabel{font-weight:500;}
.pf-disclaimer{
  margin-top:24px; padding:14px; font-size:11.5px; line-height:1.55; color:var(--muted);
  background:var(--panel); border:1px solid var(--line); border-radius:10px;
}

.pf-main{flex:1; padding:34px 40px 80px; min-width:0;}
.pf-card{
  background:var(--panel); border:1px solid var(--line); border-radius:16px;
  padding:34px 38px; max-width:760px; box-shadow:0 1px 0 rgba(0,0,0,.02);
}
.pf-eyebrow{
  font-family:'Spline Sans Mono',monospace; font-size:11.5px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--bronze); margin-bottom:12px;
}
.pf-h1{
  font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:30px;
  line-height:1.12; letter-spacing:-.02em; margin:0 0 14px;
}
.pf-lead, .pf-help{font-size:15.5px; line-height:1.6; color:var(--muted); margin:0 0 22px;}
.pf-help{font-size:14.5px;}

/* triage options */
.pf-options{display:flex; flex-direction:column; gap:11px; margin-top:6px;}
.pf-option{
  display:flex; align-items:center; gap:14px; text-align:left; width:100%;
  background:var(--paper); border:1px solid var(--line); border-radius:12px;
  padding:17px 19px; cursor:pointer; font-family:inherit; transition:.12s;
}
.pf-option:hover{border-color:var(--seal); transform:translateY(-1px);}
.pf-option.is-chosen{border-color:var(--seal); box-shadow:inset 0 0 0 1px var(--seal);}
.pf-optlabel{font-weight:600; font-size:16px;}
.pf-optsub{color:var(--muted); font-size:13.5px; margin-left:2px;}
.pf-optarrow{margin-left:auto; color:var(--seal); font-size:18px;}
.pf-optlabel + .pf-optsub{margin-left:0; flex-basis:100%;}
.pf-option{flex-wrap:wrap;}

.pf-textbtn{
  background:none; border:none; color:var(--muted); cursor:pointer;
  font-family:inherit; font-size:14px; margin-top:18px; padding:6px 0;
}
.pf-textbtn:hover{color:var(--ink);}

/* stamp */
.pf-stamp{
  float:right; margin:0 0 10px 18px; text-align:center; color:var(--bronze);
  border:2px solid var(--bronze); border-radius:10px; padding:10px 14px;
  transform:rotate(3deg); opacity:.92;
}
.pf-stamp-line{font-family:'Spline Sans Mono',monospace; font-size:10px; letter-spacing:.16em;}
.pf-stamp-type{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:15px; margin-top:3px; text-transform:uppercase;}

/* forms list */
.pf-forms{display:flex; flex-direction:column; gap:12px; margin:8px 0 8px;}
.pf-form{border:1px solid var(--line); border-radius:12px; padding:16px 18px; background:var(--paper);}
.pf-form-head{display:flex; align-items:flex-start; gap:14px;}
.pf-form-code{
  font-family:'Spline Sans Mono',monospace; font-weight:600; font-size:14px;
  background:var(--seal); color:#fff; padding:5px 9px; border-radius:7px; flex:none;
}
.pf-form-titles{flex:1; min-width:0;}
.pf-form-title{font-weight:600; font-size:15.5px;}
.pf-form-who{font-size:13px; color:var(--muted); margin-top:2px;}
.pf-form-fee{font-weight:700; font-family:'Spline Sans Mono',monospace; text-align:right; flex:none;}
.pf-form-feealt{display:block; font-size:11px; color:var(--muted); font-weight:400;}
.pf-form-note{font-size:13px; color:var(--muted); margin:10px 0 0; line-height:1.5;}
.pf-badge{display:inline-block; font-size:11px; padding:3px 8px; border-radius:20px; margin-top:10px; font-weight:600;}
.pf-badge-opt{background:#eef3ef; color:var(--ok); border:1px solid #cfe0d4;}

.pf-feeline{
  display:flex; justify-content:space-between; align-items:center; margin-top:16px;
  padding:14px 18px; background:var(--seal); color:#fff; border-radius:11px;
  font-size:15px;
}
.pf-feeline strong{font-family:'Spline Sans Mono',monospace; font-size:18px;}
.pf-finefee{font-size:12.5px; color:var(--muted); line-height:1.5; margin:10px 2px 0;}

.pf-notes{margin-top:26px; border-top:1px solid var(--line); padding-top:22px;}
.pf-notes-title{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:17px; margin-bottom:12px;}
.pf-noteitem{
  font-size:14px; line-height:1.6; color:var(--ink); margin:0 0 12px; padding-left:16px;
  border-left:3px solid var(--bronze);
}

.pf-evidence{margin-top:24px;}
.pf-detail{border:1px solid var(--line); border-radius:10px; padding:4px 14px; margin-bottom:10px; background:var(--paper);}
.pf-detail summary{cursor:pointer; padding:12px 0; font-weight:500; font-size:14.5px;}
.pf-detail-code{font-family:'Spline Sans Mono',monospace; font-weight:600; color:var(--seal);}
.pf-checklist{margin:4px 0 12px; padding-left:20px;}
.pf-checklist li{font-size:13.5px; line-height:1.55; color:var(--ink); margin-bottom:7px;}
.pf-where{font-size:13px; color:var(--muted); line-height:1.55; padding:10px 0 12px; border-top:1px dashed var(--line);}

/* fields */
.pf-fields{display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:6px;}
.pf-field{display:flex; flex-direction:column; gap:6px;}
.pf-field-wide{grid-column:1 / -1;}
.pf-label{font-size:13px; font-weight:600; color:var(--ink);}
.pf-req{color:var(--bronze);}
.pf-input{
  font-family:inherit; font-size:14.5px; padding:11px 13px; border:1px solid var(--line);
  border-radius:9px; background:#fff; color:var(--ink); width:100%;
}
.pf-input:focus{outline:none; border-color:var(--seal); box-shadow:0 0 0 3px rgba(21,81,78,.12);}
.pf-fieldnote{font-size:12px; color:var(--muted); line-height:1.4;}

/* actions */
.pf-actions{display:flex; gap:12px; flex-wrap:wrap; margin-top:28px;}
.pf-btn{
  font-family:inherit; font-size:15px; font-weight:600; padding:13px 22px;
  border-radius:10px; cursor:pointer; border:1px solid transparent;
}
.pf-btn-primary{background:var(--seal); color:#fff;}
.pf-btn-primary:hover{background:var(--seal-d);}
.pf-btn-primary:disabled{background:#a9b6b2; cursor:not-allowed;}
.pf-btn-ghost{background:transparent; color:var(--ink); border-color:var(--line);}
.pf-btn-ghost:hover{border-color:var(--seal);}
.pf-warn{font-size:13px; color:var(--warn); margin-top:14px; line-height:1.5;}

/* draft docs */
.pf-draftstack{display:flex; flex-direction:column; gap:18px;}
.pf-draftdoc{position:relative; border:1px solid var(--line); border-radius:12px; padding:22px 24px; background:#fff; overflow:hidden;}
.pf-draftdoc.is-draft{background:repeating-linear-gradient(135deg,#fffdf8,#fffdf8 22px,#fbf7ec 22px,#fbf7ec 44px);}
.pf-watermark{
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-22deg);
  font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:74px;
  color:rgba(177,112,42,.13); letter-spacing:.1em; pointer-events:none; user-select:none;
}
.pf-draftdoc-head{display:flex; justify-content:space-between; align-items:flex-start; gap:16px; border-bottom:2px solid var(--ink); padding-bottom:12px; margin-bottom:14px;}
.pf-draftdoc-code{font-family:'Spline Sans Mono',monospace; font-weight:600; font-size:13px; color:var(--seal);}
.pf-draftdoc-title{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:18px; margin-top:3px;}
.pf-draftdoc-who{font-size:12px; color:var(--muted); text-align:right; max-width:150px;}
.pf-draftparts{margin:0; position:relative;}
.pf-draftpart{display:grid; grid-template-columns:170px 1fr; gap:16px; padding:9px 0; border-bottom:1px dotted var(--line);}
.pf-draftpart dt{font-size:12.5px; font-weight:600; color:var(--seal); font-family:'Spline Sans Mono',monospace;}
.pf-draftpart dd{margin:0; font-size:14px; line-height:1.5;}

.pf-finalnote, .pf-finefee, .pf-receipt-fine{font-size:12.5px;}
.pf-finalnote{margin-top:22px; padding:16px 18px; background:#eef3ef; border:1px solid #cfe0d4; border-radius:11px; line-height:1.55; color:var(--ink);}

/* assembly */
.pf-assembly{margin-top:26px; border-top:1px solid var(--line); padding-top:22px;}
.pf-asmblock{margin-bottom:22px;}
.pf-asmlabel{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:15px; margin-bottom:12px; color:var(--seal);}
.pf-signrow{display:flex; gap:12px; padding:9px 0; border-bottom:1px dotted var(--line); align-items:flex-start;}
.pf-signcode{font-family:'Spline Sans Mono',monospace; font-size:12px; font-weight:600; background:var(--seal); color:#fff; padding:3px 7px; border-radius:5px; flex:none;}
.pf-signtext{font-size:13.5px; line-height:1.55;}
.pf-order{margin:0; padding-left:22px;}
.pf-order li{font-size:14px; line-height:1.6; margin-bottom:9px;}
.pf-orderev{color:var(--muted); font-size:12.5px;}
.pf-mailbox{border:1px solid var(--line); border-radius:11px; padding:16px 18px; background:var(--paper);}
.pf-mailnote{margin:10px 0 0; font-size:0.86rem; line-height:1.5; color:#7a4a12; background:#fef6e9; border:1px solid #f1d9af; border-radius:8px; padding:9px 11px;}
.pf-mailtitle{font-weight:600; font-size:14.5px; margin-bottom:6px;}
.pf-mailbody{font-size:13.5px; color:var(--muted); line-height:1.55; margin:0 0 12px;}
.pf-mailaddr{font-family:'Spline Sans Mono',monospace; font-size:13px; background:#fff; border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin-bottom:8px; line-height:1.5;}
.pf-mailaddr span{display:block; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--bronze); margin-bottom:3px;}
.pf-mailverify{font-size:12.5px; color:var(--warn); line-height:1.55; margin:8px 0 0;}

/* payment */
.pf-receipt{border:1px solid var(--line); border-radius:12px; padding:18px 20px; background:var(--paper); margin-bottom:22px;}
.pf-receipt-row{display:flex; justify-content:space-between; font-size:15.5px; font-weight:600;}
.pf-receipt-row strong{font-family:'Spline Sans Mono',monospace;}
.pf-receipt-fine{color:var(--muted); margin-top:10px; line-height:1.5;}

@media (max-width:880px){
  .pf-shell{flex-direction:column;}
  .pf-rail{width:100%; position:static; border-right:none; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:6px;}
  .pf-stage{width:auto;}
  .pf-stagelabel{display:none;}
  .pf-disclaimer{flex-basis:100%; margin-top:10px;}
  .pf-main{padding:24px 18px 60px;}
  .pf-card{padding:24px 20px;}
  .pf-fields{grid-template-columns:1fr;}
  .pf-h1{font-size:25px;}
  .pf-draftpart{grid-template-columns:1fr;}
}
@media print{
  .pf-top,.pf-rail,.pf-actions,.pf-eyebrow,.pf-help{display:none;}
  .pf-card{border:none; box-shadow:none; padding:0;}
}
@media (prefers-reduced-motion:reduce){.pf-option{transition:none;}}
`;

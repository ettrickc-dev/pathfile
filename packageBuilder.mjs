// Server-side package builder. Mirrors the client builder in App.jsx so the emailed/
// stored PDF is identical to what the user previews. Shared DATA (mailing addresses,
// hand-write items, fees, evidence, signing) is imported from formsRegistry.js so it
// never drifts. If you change the cover-letter or instruction WORDING in App.jsx,
// make the same change here.  getBlank(code) -> Uint8Array of the blank PDF.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fillPackage } from "./pdfFiller.mjs";
import { FEES, FORM_META, EVIDENCE, SIGN_INFO, MAILING, HANDWRITE } from "./formsRegistry.js";

const todayStr = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function subjectName(d) {
  return [d.s_first, d.s_middle, d.s_last].filter(Boolean).join(" ") || "the applicant";
}
function totalFee(result) {
  return result.forms.reduce((s, f) => s + ((FEES[f.code] && FEES[f.code].paper) || 0), 0);
}
export function assemblyOrder(result) {
  const priority = ["G-1450", "I-130", "I-130A", "I-485", "I-765", "I-131", "I-864", "I-693", "I-129F", "I-751", "I-90", "N-400", "N-600"];
  const present = result.forms.map((f) => f.code);
  return priority.filter((c) => present.includes(c));
}
export function mailingFor(result) {
  const codes = result.forms.map((f) => f.code);
  if (result.concurrent) return MAILING.familyConcurrent;
  if (codes.includes("N-400")) return MAILING["N-400"];
  if (codes.includes("N-600")) return MAILING["N-600"];
  if (codes.includes("I-90")) return MAILING["I-90"];
  if (codes.includes("I-751")) return MAILING["I-751"];
  if (codes.includes("I-129F")) return MAILING["I-129F"];
  return MAILING["I-130"];
}
export function handwriteFor(order) {
  return order.map((c) => ({ code: c, items: HANDWRITE[c] || [] })).filter((x) => x.items.length);
}
function packageInstructions(result, data) {
  const name = subjectName(data);
  const codes = result.forms.map((f) => f.code);
  const m = mailingFor(result);
  const fee = totalFee(result);
  const hasG1450 = codes.includes("G-1450");
  return { name, m, fee, hasG1450, codes };
}
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
export async function buildPackagePdf(getBlank, clientData, result, data, fieldIndex) {
  const formCodes = result.forms.map((f) => f.code);
  const filled = await fillPackage(clientData, formCodes, getBlank, fieldIndex);
  const included = filled.filter((r) => r.bytes).map((r) => r.code);
  const missing = filled.filter((r) => !r.bytes).map((r) => r.code);

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  const { name, m, fee, hasG1450 } = packageInstructions(result, data);
  const order = assemblyOrder(result);

  const lines = [
    { text: "U.S. Citizenship and Immigration Services", bold: true, size: 13 },
    { text: m.usps || m.label, after: 6 },
    { text: todayStr(), after: 10 },
    { text: `Re: ${result.caseType} — ${name}`, bold: true },
    { text: data.s_anum ? `A-Number: ${data.s_anum}` : "", after: 8 },
    { text: "To Whom It May Concern:", after: 6 },
    { text: `Please find enclosed the following form(s) filed on behalf of ${name}:`, after: 6 },
  ];
  order.forEach((c) => lines.push({ text: `   • Form ${c} — ${FORM_META[c].title}` }));
  lines.push({ gap: 6 });
  lines.push({ text: hasG1450
    ? `The total USCIS filing fee of $${fee.toLocaleString()} is authorized by the enclosed Form G-1450 (credit card).`
    : `The total USCIS filing fee is $${fee.toLocaleString()}.`, after: 8 });
  lines.push({ text: "All required supporting evidence is enclosed. Please direct any questions to the contact information provided on the forms.", after: 10 });
  lines.push({ text: "Respectfully,", after: 24 });
  lines.push({ text: "_______________________________" });
  lines.push({ text: `${name}`, after: 16 });

  lines.push({ gap: 10 });
  lines.push({ text: "YOUR FILING INSTRUCTIONS — read before mailing", bold: true, size: 13, after: 8 });

  let step = 1;
  const hw = handwriteFor(order);
  lines.push({ text: `${step++}. Finish these items by hand first:`, bold: true, after: 4 });
  lines.push({ text: "   • Write in anything you chose to leave blank — for example your Social Security number or A-Number. We left those exactly where they belong so you can add them by hand." });
  hw.forEach(({ code, items }) => {
    lines.push({ text: `   On Form ${code}, also complete by hand:` });
    items.forEach((it) => lines.push({ text: `      • ${it}` }));
  });
  lines.push({ text: "   Use black ink and write clearly. Do all of this before you sign.", after: 2 });
  lines.push({ gap: 6 });

  lines.push({ text: `${step++}. Sign each form (black ink, the correct person):`, bold: true, after: 4 });
  order.forEach((c) => {
    const s = SIGN_INFO[c];
    if (s) lines.push({ text: `   • ${c}: ${s.part} — signed by ${s.who}.` });
  });
  lines.push({ gap: 6 });

  lines.push({ text: `${step++}. Stack the package in this order:`, bold: true, after: 4 });
  order.forEach((c, i) => lines.push({ text: `   ${i + 1}. ${c} — ${FORM_META[c].title}` }));
  lines.push({ gap: 6 });

  lines.push({ text: `${step++}. Attach this evidence:`, bold: true, after: 4 });
  order.forEach((c) => {
    (EVIDENCE[c] || []).forEach((e) => lines.push({ text: `   • [${c}] ${e}` }));
  });
  lines.push({ gap: 6 });

  lines.push({ text: `${step++}. Pay the USCIS filing fee:`, bold: true, after: 4 });
  lines.push({ text: `   Total: $${fee.toLocaleString()}, paid to USCIS (this is separate from what you paid us).` });
  lines.push({ text: `   You can pay USCIS two ways:` });
  lines.push({ text: `      • By credit/debit card: use Form G-1450. Write the total above on it and place it on top of your package. (You can download Form G-1450 from your results page.)` });
  lines.push({ text: `      • By check or money order: make it payable to "U.S. Department of Homeland Security" for the total above.` });
  lines.push({ text: `   Prefer to file online? Many forms (including N-400 and I-90) can be filed at my.uscis.gov, where you pay the fee right on the site.` });
  lines.push({ gap: 6 });

  lines.push({ text: `${step++}. Mail your complete package to:`, bold: true, after: 4 });
  lines.push({ text: `   ${m.label}` });
  if (m.body) lines.push({ text: `   ${m.body}` });
  if (m.usps) lines.push({ text: `   By USPS: ${m.usps}` });
  if (m.courier) lines.push({ text: `   By courier (FedEx/UPS/DHL): ${m.courier}` });
  lines.push({ text: `   Tip: the exact USCIS address can depend on your state and occasionally changes, so it's worth a quick confirm at uscis.gov before you mail.` });
  lines.push({ text: `   Address page: ${m.url}`, after: 6 });

  if (missing.length) {
    lines.push({ gap: 8 });
    lines.push({ text: `NOTE: These form(s) are not yet included because their blank PDF has not been added to this Easy Immigration Filing install: ${missing.join(", ")}.`, bold: true });
  }

  drawTextPages(out, lines, font, fontBold);

  for (const code of order) {
    const r = filled.find((x) => x.code === code);
    if (!r || !r.bytes) continue;
    try {
      const srcPdf = await PDFDocument.load(r.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(srcPdf, srcPdf.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch { }
  }

  const bytes = await out.save();
  return { bytes, included, missing };
}

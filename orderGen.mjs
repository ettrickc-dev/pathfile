// Shared order helpers used by the Netlify functions (checkout, webhook, order).
// Lives at repo root (NOT in functions/) so Netlify doesn't treat it as an endpoint.
import { getStore } from "@netlify/blobs";
import { buildPackagePdf } from "./packageBuilder.mjs";
import { PDF_FILES } from "./formsRegistry.js";
import fieldIndex from "./field_index.json" with { type: "json" };

export const PRICE_CENTS = 9900; // $99.00 — change here to change the price.
export const PRICE_LABEL = "$99";

export function ordersStore() { return getStore("pathfile-orders"); }
export function filesStore() { return getStore("pathfile-files"); }

export function rnd(n = 24) {
  const a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = ""; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const SITE = () => (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");

async function getBlank(code) {
  const file = PDF_FILES[code];
  if (!file) throw new Error("no blank for " + code);
  const url = `${SITE()}/blanks/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blank fetch failed ${code} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function getOrder(orderId) {
  return await ordersStore().get(`order:${orderId}`, { type: "json" });
}
export async function putOrder(order) {
  await ordersStore().setJSON(`order:${order.id}`, order);
}
export async function indexByEmail(email, entry) {
  const key = `email:${String(email).trim().toLowerCase()}`;
  const list = (await ordersStore().get(key, { type: "json" })) || [];
  list.push(entry);
  await ordersStore().setJSON(key, list);
}
export async function ordersForEmail(email) {
  const key = `email:${String(email).trim().toLowerCase()}`;
  return (await ordersStore().get(key, { type: "json" })) || [];
}

export async function ensurePackage(orderId) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("order not found");
  if (order.status !== "paid") { order.status = "paid"; order.paidAt = Date.now(); }

  let ready = false;
  const existing = await filesStore().get(`pdf:${orderId}`, { type: "arrayBuffer" }).catch(() => null);
  if (existing && existing.byteLength) {
    ready = true;
  } else {
    const { bytes } = await buildPackagePdf(getBlank, order.clientData, order.result, order.data, fieldIndex);
    await filesStore().set(`pdf:${orderId}`, bytes);
    order.ready = true;
    ready = true;
  }
  await putOrder(order);
  if (!order.emailedAt) {
    await sendDeliveryEmail(order);
    order.emailedAt = Date.now();
    await putOrder(order);
  }
  return { ready };
}

export async function getPackageBytes(orderId) {
  const buf = await filesStore().get(`pdf:${orderId}`, { type: "arrayBuffer" }).catch(() => null);
  return buf && buf.byteLength ? new Uint8Array(buf) : null;
}

export function magicLink(order) {
  return `${SITE()}/app/?order=${order.id}&token=${order.token}`;
}

export async function sendDeliveryEmail(order) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!key || !from) return;
  const link = magicLink(order);
  const name = order.subjectName || "there";
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#16282b;line-height:1.5">
      <h2 style="color:#15514e">Your Easy Immigration Filing package is ready</h2>
      <p>Hi ${name}, thank you for your order. Your completed USCIS forms, cover letter,
      and step-by-step instructions are ready.</p>
      ${order.attorneyReview ? '<p><strong>Attorney review:</strong> a licensed immigration attorney will review your package and we\'ll email you within 2–3 business days with any suggested changes before you file.</p>' : ''}
      <p><a href="${link}" style="background:#15514e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Download my completed package</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p><strong>Keep this email.</strong> You can use this link any time to download your forms again.
      You can also retrieve them later by entering this email address on our site.</p>
      <hr><p style="font-size:12px;color:#5c6b66">Easy Immigration Filing is a self-help document-preparation service. It is not a law firm and does not provide legal advice. Confirm fees and mailing addresses at uscis.gov before filing.</p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: order.email, subject: "Your Easy Immigration Filing completed forms", html }),
  });
}

export async function sendRetrievalEmail(email, orders) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!key || !from) return;
  const links = orders.map((o) => `<li><a href="${SITE()}/app/?order=${o.orderId}&token=${o.token}">Download package from ${new Date(o.createdAt).toLocaleDateString()}</a></li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#16282b;line-height:1.5">
      <h2 style="color:#15514e">Your Easy Immigration Filing downloads</h2>
      <p>Here are the completed packages linked to this email:</p>
      <ul>${links || "<li>No paid orders found for this email.</li>"}</ul>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: email, subject: "Your Easy Immigration Filing downloads", html }),
  });
}

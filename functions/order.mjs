// One endpoint for: payment status (+ idempotent generate), package download,
// customer self-retrieval by email, and operator admin lookup.
import Stripe from "stripe";
import {
  getOrder, putOrder, ensurePackage, getPackageBytes, ordersForEmail, sendRetrievalEmail,
} from "../orderGen.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ---- customer self-retrieval: POST { email } ----
    if (action === "retrieve" && req.method === "POST") {
      const { email } = await req.json();
      if (!email) return Response.json({ error: "email required" }, { status: 400 });
      const all = await ordersForEmail(email);
      // only surface paid orders
      const paid = [];
      for (const e of all) {
        const o = await getOrder(e.orderId);
        if (o && (o.status === "paid")) paid.push(e);
      }
      await sendRetrievalEmail(email, paid);
      return Response.json({ ok: true, count: paid.length });
    }

    // ---- admin lookup: ?action=admin&email=&key= ----
    if (action === "admin") {
      if (url.searchParams.get("key") !== process.env.ADMIN_KEY)
        return new Response("forbidden", { status: 403 });
      const email = url.searchParams.get("email");
      const list = email ? await ordersForEmail(email) : [];
      const out = [];
      for (const e of list) {
        const o = await getOrder(e.orderId);
        if (o) out.push({ id: o.id, email: o.email, name: o.subjectName, caseType: o.caseType,
          forms: o.forms, status: o.status, createdAt: o.createdAt, ready: !!o.ready,
          link: `${(process.env.SITE_URL||process.env.URL||"").replace(/\/$/,"")}/?order=${o.id}&token=${o.token}` });
      }
      return Response.json({ orders: out });
    }

    // ---- everything else needs order + token ----
    const orderId = url.searchParams.get("order");
    const token = url.searchParams.get("token");
    if (!orderId || !token) return Response.json({ error: "order & token required" }, { status: 400 });
    const order = await getOrder(orderId);
    if (!order || order.token !== token) return new Response("not found", { status: 404 });

    // ---- status (verifies payment with Stripe, then generates if needed) ----
    if (action === "status") {
      if (order.status !== "paid" && order.sessionId) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const sess = await stripe.checkout.sessions.retrieve(order.sessionId);
          if (sess && sess.payment_status === "paid") {
            order.status = "paid"; order.paidAt = Date.now(); await putOrder(order);
          }
        } catch {}
      }
      if (order.status === "paid") {
        try { await ensurePackage(orderId); } catch {}
      }
      const bytes = await getPackageBytes(orderId);
      return Response.json({ paid: order.status === "paid", ready: !!(bytes && bytes.length) });
    }

    // ---- download ----
    if (action === "download") {
      if (order.status !== "paid" && order.sessionId) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const sess = await stripe.checkout.sessions.retrieve(order.sessionId);
          if (sess && sess.payment_status === "paid") { order.status = "paid"; await putOrder(order); }
        } catch {}
      }
      if (order.status === "paid") {
        try { await ensurePackage(orderId); } catch {}
      }
      const bytes = await getPackageBytes(orderId);
      if (!bytes) return new Response("not ready", { status: 409 });
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="PathFile_USCIS_Package.pdf"',
        },
      });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

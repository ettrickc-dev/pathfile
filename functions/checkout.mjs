// Creates a Stripe Checkout session and stores the pending order.
import Stripe from "stripe";
import { ordersStore, putOrder, indexByEmail, rnd, PRICE_CENTS } from "../orderGen.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const { clientData, result, data, email } = body || {};
    if (!email || !result || !data) return Response.json({ error: "Missing data" }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const id = rnd(20);
    const token = rnd(28);
    const subjectName = [data.s_first, data.s_middle, data.s_last].filter(Boolean).join(" ") || "Applicant";
    const order = {
      id, token, email: String(email).trim(), subjectName,
      clientData, result, data,
      status: "pending", createdAt: Date.now(),
      caseType: result.caseType, forms: result.forms.map((f) => f.code),
    };
    await putOrder(order);
    await indexByEmail(email, { orderId: id, token, createdAt: order.createdAt });

    const site = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `PathFile preparation — ${result.caseType}` },
          unit_amount: PRICE_CENTS,
        },
        quantity: 1,
      }],
      customer_email: String(email).trim(),
      metadata: { orderId: id },
      success_url: `${site}/?order=${id}&token=${token}&paid=1`,
      cancel_url: `${site}/?canceled=1`,
    });
    order.sessionId = session.id;
    await putOrder(order);
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

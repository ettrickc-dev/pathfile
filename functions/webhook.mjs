// Stripe webhook: when payment completes, generate + store + email the package.
import Stripe from "stripe";
import { ensurePackage } from "../orderGen.mjs";

export const config = { path: "/stripe-webhook" };

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Webhook signature error: ${e.message}`, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const orderId = event.data.object.metadata?.orderId;
    if (orderId) {
      try { await ensurePackage(orderId); }
      catch (e) { return new Response(`gen error: ${e.message}`, { status: 500 }); }
    }
  }
  return new Response("ok", { status: 200 });
};

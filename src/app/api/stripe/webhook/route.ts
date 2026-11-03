import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { paymentsOn, recordCheckout, refreshPayouts, stripe } from "@/lib/payments";

/**
 * Stripe tells us here when a deposit is paid, even if the car owner closed the tab before coming back.
 * In Stripe: Developers > Webhooks > Add endpoint, URL https://<your site>/api/stripe/webhook, events
 * checkout.session.completed, checkout.session.async_payment_succeeded and account.updated
 * (tick "Listen to events on Connected accounts" for that one). Put the signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !paymentsOn()) return NextResponse.json({ error: "not set up" }, { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await recordCheckout(event.data.object as Stripe.Checkout.Session);
  } else if (event.type === "account.updated") {
    const a = event.data.object as Stripe.Account;
    if (a.metadata?.pro_id) await refreshPayouts(a.metadata.pro_id);
  }
  return NextResponse.json({ received: true });
}

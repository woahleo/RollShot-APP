import Stripe from "stripe";
import { createClient as createSupabase } from "@supabase/supabase-js";

/**
 * Deposits through Stripe. Everything here runs on the server only.
 * Needs STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY in Vercel. Without them deposits stay off
 * and booking works exactly as before. STRIPE_API_BASE is only for local testing against stripe-mock.
 */
export function paymentsOn() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let client: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not set up yet");
  if (!client) {
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      appInfo: { name: "Rollshot" },
      ...(base ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") as "http" | "https" } : {}),
    });
  }
  return client;
}

/** Supabase with the service key: can do what the app's users can't (mark a deposit paid). */
export function admin() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Is this Stripe Express account able to receive deposits? */
export function accountReady(a: Stripe.Account) {
  return Boolean(a.details_submitted && a.charges_enabled && a.capabilities?.transfers === "active");
}

/** Re-check a photographer's Stripe account and save whether it can take deposits. */
export async function refreshPayouts(proId: string) {
  const db = admin();
  const { data } = await db.from("payout_accounts").select("stripe_account_id, ready").eq("pro_id", proId).maybeSingle();
  if (!data) return null;
  const account = await stripe().accounts.retrieve(data.stripe_account_id);
  const ready = accountReady(account);
  if (ready !== data.ready) await db.from("payout_accounts").update({ ready }).eq("pro_id", proId);
  return ready;
}

/** Record a finished Checkout. Safe to call twice (the return page and the webhook both do). */
export async function recordCheckout(session: Stripe.Checkout.Session) {
  const booking = session.metadata?.booking;
  if (!booking || session.payment_status !== "paid") return null;
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { data, error } = await admin().rpc("deposit_paid", { p_booking: booking, p_checkout: session.id, p_intent: intent });
  if (error) throw error;
  if (data === "refund_due") await settleRefunds([booking]);
  return data as string;
}

/**
 * Send back deposits the database marked for a refund (declined, withdrawn, cancelled in time).
 * The money comes back from the photographer's share and Rollshot's cut, so the car owner gets it all.
 * Stripe's idempotency key makes a retry after a timeout safe.
 */
export async function settleRefunds(bookingIds?: string[]) {
  if (!paymentsOn()) return 0;
  const db = admin();
  let q = db.from("bookings").select("id, booking_payments(payment_intent)").eq("deposit_status", "refund_due").limit(20);
  if (bookingIds) q = q.in("id", bookingIds);
  const { data } = await q;
  let done = 0;
  for (const row of (data ?? []) as unknown as { id: string; booking_payments: { payment_intent: string | null } | null }[]) {
    const intent = row.booking_payments?.payment_intent;
    if (!intent) continue;
    try {
      const refund = await stripe().refunds.create(
        { payment_intent: intent, reverse_transfer: true, refund_application_fee: true, metadata: { booking: row.id } },
        { idempotencyKey: `refund-${row.id}` },
      );
      await db.rpc("deposit_refunded", { p_booking: row.id, p_refund: refund.id });
      done++;
    } catch (e) {
      // Left as refund_due, so the next page load or cancel tries again.
      console.error("refund failed", row.id, e);
    }
  }
  return done;
}

/** Same rule as the database, for showing the amount before booking. */
export function depositFor(price: number) {
  return Math.min(price, Math.max(20, Math.round(price * 0.25)));
}

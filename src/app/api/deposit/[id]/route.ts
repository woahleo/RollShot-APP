import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { admin, paymentsOn, stripe } from "@/lib/payments";

/** Car owner: pay the deposit on one of their bookings with Stripe Checkout. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = req.nextUrl.origin;
  const back = (q = "") => NextResponse.redirect(`${origin}/shoots${q}`, 303);
  const { user } = await getMe();
  if (!user) return NextResponse.redirect(`${origin}/signup?next=/shoots`);
  if (!paymentsOn()) return back();
  const db = admin();
  const { data: b } = await db
    .from("bookings")
    .select("id, client_id, pro_id, package_name, shoot_date, status, deposit_cents, fee_cents, deposit_status, booking_payments(checkout_id), pro:pros(profiles(name))")
    .eq("id", id)
    .maybeSingle();
  const row = b as unknown as {
    id: string; client_id: string; pro_id: string; package_name: string; shoot_date: string; status: string;
    deposit_cents: number; fee_cents: number; deposit_status: string;
    booking_payments: { checkout_id: string | null } | null; pro: { profiles: { name: string } | null } | null;
  } | null;
  if (!row || row.client_id !== user.id) return back();
  if (row.deposit_status !== "due" || row.status === "declined" || row.status === "cancelled") return back();

  // A Checkout already open for this booking (another tab, or they came back): use it, so it can't be paid twice.
  const open = row.booking_payments?.checkout_id;
  if (open) {
    const s = await stripe().checkout.sessions.retrieve(open).catch(() => null);
    if (s?.status === "open" && s.url) return NextResponse.redirect(s.url, 303);
    if (s?.status === "complete") return NextResponse.redirect(`${origin}/api/deposit/${id}/done?session_id=${s.id}`, 303);
  }
  const { data: acct } = await db.from("payout_accounts").select("stripe_account_id, ready").eq("pro_id", row.pro_id).maybeSingle();
  if (!acct?.ready) return back("?deposit=unavailable");

  const name = row.pro?.profiles?.name ?? "your photographer";
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: row.deposit_cents,
        product_data: { name: `Deposit: ${row.package_name} with ${name}`, description: `Shoot on ${row.shoot_date}. The rest is paid to ${name} directly.` },
      },
    }],
    payment_intent_data: {
      application_fee_amount: row.fee_cents,
      transfer_data: { destination: acct.stripe_account_id },
      metadata: { booking: row.id },
      description: `Rollshot deposit ${row.id}`,
    },
    metadata: { booking: row.id },
    success_url: `${origin}/api/deposit/${id}/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shoots?deposit=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  await db.from("booking_payments").upsert({ booking_id: row.id, checkout_id: session.id, updated_at: new Date().toISOString() });
  return NextResponse.redirect(session.url!, 303);
}

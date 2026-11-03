import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { admin, paymentsOn, stripe } from "@/lib/payments";

/** Photographer: start (or pick up) linking a bank with Stripe, then come back to /api/payouts/return. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const { user, profile } = await getMe();
  if (!user) return NextResponse.redirect(`${origin}/signup?next=/pro`);
  if (profile?.role !== "pro" || !paymentsOn()) return NextResponse.redirect(`${origin}/pro`);
  const db = admin();
  const { data: row } = await db.from("payout_accounts").select("stripe_account_id").eq("pro_id", user.id).maybeSingle();
  let account = row?.stripe_account_id as string | undefined;
  if (!account) {
    const created = await stripe().accounts.create(
      {
        type: "express",
        country: "US",
        email: user.email ?? undefined,
        business_type: "individual",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { product_description: "Car photo and video shoots booked through Rollshot", mcc: "7221" },
        metadata: { pro_id: user.id },
      },
      { idempotencyKey: `payout-account-${user.id}` },
    );
    account = created.id;
    const { error } = await db.from("payout_accounts").upsert({ pro_id: user.id, stripe_account_id: account }, { onConflict: "pro_id", ignoreDuplicates: true });
    if (error) return NextResponse.redirect(`${origin}/pro?payouts=error`);
  }
  const link = await stripe().accountLinks.create({
    account,
    type: "account_onboarding",
    refresh_url: `${origin}/api/payouts`,
    return_url: `${origin}/api/payouts/return`,
  });
  return NextResponse.redirect(link.url, 303);
}

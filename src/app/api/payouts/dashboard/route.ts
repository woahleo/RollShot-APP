import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { admin, paymentsOn, stripe } from "@/lib/payments";

/** Photographer: open their Stripe payouts page (balance, bank, payout history). */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const { user } = await getMe();
  if (!user || !paymentsOn()) return NextResponse.redirect(`${origin}/pro`);
  const { data } = await admin().from("payout_accounts").select("stripe_account_id, ready").eq("pro_id", user.id).maybeSingle();
  if (!data) return NextResponse.redirect(`${origin}/pro`);
  if (!data.ready) return NextResponse.redirect(`${origin}/api/payouts`);
  const link = await stripe().accounts.createLoginLink(data.stripe_account_id);
  return NextResponse.redirect(link.url, 303);
}

import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { paymentsOn, recordCheckout, stripe } from "@/lib/payments";

/** Back from Stripe Checkout. The webhook records the payment too; whichever comes first wins. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = req.nextUrl.origin;
  const sid = req.nextUrl.searchParams.get("session_id");
  const { user } = await getMe();
  if (!user || !paymentsOn() || !sid) return NextResponse.redirect(`${origin}/shoots`, 303);
  const session = await stripe().checkout.sessions.retrieve(sid).catch(() => null);
  if (!session || session.metadata?.booking !== id) return NextResponse.redirect(`${origin}/shoots`, 303);
  const result = await recordCheckout(session).catch(() => null);
  return NextResponse.redirect(`${origin}/shoots?deposit=${result === "paid" || result === "refund_due" ? result : "pending"}`, 303);
}

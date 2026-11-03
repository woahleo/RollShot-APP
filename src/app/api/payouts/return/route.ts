import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { paymentsOn, refreshPayouts } from "@/lib/payments";

/** Back from Stripe's setup pages: save whether the photographer can take deposits now. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const { user } = await getMe();
  if (!user || !paymentsOn()) return NextResponse.redirect(`${origin}/pro`);
  const ready = await refreshPayouts(user.id).catch(() => null);
  return NextResponse.redirect(`${origin}/pro?payouts=${ready ? "ready" : "pending"}#payouts`);
}

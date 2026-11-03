import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { settleRefunds } from "@/lib/payments";

/** After a decline or cancel: send back the deposit if the database says it's owed. */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getMe();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { booking } = (await req.json().catch(() => ({}))) as { booking?: string };
  if (!booking) return NextResponse.json({ ok: false }, { status: 400 });
  // Only the two people on the booking can nudge it (row security hides it from anyone else).
  const { data } = await supabase.from("bookings").select("id").eq("id", booking).maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const n = await settleRefunds([booking]);
  return NextResponse.json({ ok: true, refunded: n });
}

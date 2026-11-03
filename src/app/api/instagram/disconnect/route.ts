import { NextResponse } from "next/server";
import { getMe } from "@/lib/supabase/server";

// Forget the creator's Instagram login. Photos they already imported stay in their portfolio.
export async function POST() {
  const { supabase, user } = await getMe();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { error } = await supabase.rpc("forget_instagram");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

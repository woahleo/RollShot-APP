import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google, Apple and email links all land here with a one-time code.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const role = url.searchParams.get("role");
  const next = url.searchParams.get("next") ?? "";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/signup?error=link", url.origin));
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/signup", url.origin));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile) {
    const q = role === "pro" || role === "client" ? `?role=${role}` : "";
    return NextResponse.redirect(new URL(`/onboarding${q}`, url.origin));
  }
  return NextResponse.redirect(new URL(safeNext || (profile.role === "pro" ? "/pro" : "/book"), url.origin));
}

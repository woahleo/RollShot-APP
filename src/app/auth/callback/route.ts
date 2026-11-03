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
  const back = (reason: string) => {
    const q = new URLSearchParams({ error: "link", reason });
    if (role === "pro" || role === "client") q.set("role", role);
    if (url.searchParams.get("via") === "site") q.set("via", "site");
    return NextResponse.redirect(new URL(`/signup?${q}`, url.origin));
  };
  // Google (or Supabase) said no before we ever got a code.
  const providerError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (!code && providerError) return back(providerError);
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // The same link can be opened twice (double tap, browser retry). If the first one signed us in, just carry on.
      const { data: { user: already } } = await supabase.auth.getUser();
      if (!already) {
        console.error("auth callback: code exchange failed", error.code, error.message);
        return back(error.code ?? "unknown");
      }
    }
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/signup", url.origin));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile) {
    const q = role === "pro" || role === "client" ? `?role=${role}` : "";
    return NextResponse.redirect(new URL(`/onboarding${q}`, url.origin));
  }
  if ((role === "pro" || role === "client") && role !== profile.role) {
    // They picked the other side, but this account is already set up; explain instead of silently switching.
    return NextResponse.redirect(new URL(`/signup?role=${role}`, url.origin));
  }
  return NextResponse.redirect(new URL(safeNext || (profile.role === "pro" ? "/pro" : "/book"), url.origin));
}

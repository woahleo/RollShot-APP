import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Where the sign-in email's link lands (see the email templates in Supabase). Unlike /auth/callback,
 * it checks the link itself instead of a code tied to the browser that asked for it, so the link
 * works on any phone or computer. Then /auth/callback sends them to onboarding or home as usual.
 *
 * The template adds the address it was asked to come back to (Supabase's {{ .RedirectTo }}) at the
 * end, after redirect_to=. Only its role and next are kept, so it can't send anyone off the site.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  // Everything after "redirect_to=" is the original address, which has its own ?role=…&next=….
  const raw = url.search.split(/[?&]redirect_to=/)[1] ?? "";
  let role = "";
  let next = "";
  try {
    const back = new URL(decodeURIComponent(raw), url.origin);
    role = back.searchParams.get("role") ?? "";
    next = back.searchParams.get("next") ?? "";
  } catch {}

  const q = new URLSearchParams();
  if (role === "pro" || role === "client") q.set("role", role);
  if (next.startsWith("/") && !next.startsWith("//")) q.set("next", next);

  if (!tokenHash || !TYPES.includes(type)) {
    q.set("error", "link");
    q.set("reason", "bad_link");
    return NextResponse.redirect(new URL(`/signup?${q}`, url.origin));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    // Opened twice (mail apps sometimes check links first): if the first one signed us in, carry on.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("auth confirm: link check failed", error.code, error.message);
      q.set("error", "link");
      q.set("reason", error.code ?? "unknown");
      return NextResponse.redirect(new URL(`/signup?${q}`, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/auth/callback${q.size ? `?${q}` : ""}`, url.origin));
}

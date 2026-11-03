import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getMe } from "@/lib/supabase/server";
import { IG, STATE_COOKIE, igReady, redirectUri } from "@/lib/instagram";

// "Connect Instagram": send the creator to Instagram's login, with a one-time state to check on the way back.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const { user, profile } = await getMe();
  if (!user) return NextResponse.redirect(new URL("/signup?next=/pro/instagram", origin));
  if (profile?.role !== "pro") return NextResponse.redirect(new URL("/", origin));
  if (!igReady()) return NextResponse.redirect(new URL("/pro/instagram?error=setup", origin));
  const state = randomBytes(16).toString("hex");
  const q = new URLSearchParams({
    client_id: IG.appId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: IG.scope,
    state,
    enable_fb_login: "false",
  });
  const res = NextResponse.redirect(`${IG.authUrl}/oauth/authorize?${q}`);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/api/instagram" });
  return res;
}

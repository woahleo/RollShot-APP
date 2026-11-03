import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { STATE_COOKIE, exchangeCode } from "@/lib/instagram";

// Instagram sends the creator back here with a one-time code (or an error if they said no).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/pro/instagram${q}`, url.origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/instagram" });
    return res;
  };
  const { supabase, user, profile } = await getMe();
  if (!user || profile?.role !== "pro") return NextResponse.redirect(new URL("/signup?next=/pro/instagram", url.origin));
  if (url.searchParams.get("error")) return back("?error=denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) return back("?error=state");
  try {
    const ig = await exchangeCode(code, url.origin);
    const { error } = await supabase.rpc("save_instagram_link", { p_ig_user: ig.igUserId, p_username: ig.username, p_token: ig.token, p_expires: ig.expires });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("instagram callback:", e instanceof Error ? e.message : e);
    return back("?error=exchange");
  }
  return back("?connected=1");
}

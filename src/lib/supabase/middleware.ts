import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PRIVATE = ["/me", "/pro", "/messages", "/onboarding", "/settings", "/requests/new", "/shoots"];

export async function updateSession(request: NextRequest) {
  // If Supabase didn't recognise our callback URL it falls back to the Site URL (usually "/?code=...").
  // Send that code on to the callback so the sign-in still finishes on the first try.
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code") ?? (sp.get("error_description") ? "" : null);
  if (code !== null && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.searchParams.set("via", "site");
    return NextResponse.redirect(url);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && PRIVATE.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { listMedia, tokenFor } from "@/lib/instagram";

// A page of the creator's own Instagram posts, for the picker.
export async function GET(request: NextRequest) {
  const { supabase, user } = await getMe();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const token = await tokenFor(supabase);
  if (!token) return NextResponse.json({ error: "Connect Instagram first" }, { status: 409 });
  try {
    const page = await listMedia(token, request.nextUrl.searchParams.get("after"));
    return NextResponse.json({
      after: page.after,
      items: page.items.map((m) => ({
        id: m.id,
        type: m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "album" : "photo",
        thumb: m.media_type === "VIDEO" ? m.thumbnail_url ?? null : m.media_url ?? m.children?.data?.find((c) => c.media_url)?.media_url ?? null,
        permalink: m.permalink,
        caption: (m.caption ?? "").slice(0, 120),
        photos: m.media_type === "IMAGE" ? 1 : m.media_type === "CAROUSEL_ALBUM" ? (m.children?.data ?? []).filter((c) => c.media_type === "IMAGE").length : 0,
        hasVideo: m.media_type === "VIDEO" || (m.children?.data ?? []).some((c) => c.media_type === "VIDEO"),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Instagram didn't answer";
    // An expired or revoked login: tell the page so it can offer to reconnect.
    const expired = /session|token|expired|OAuth/i.test(msg);
    return NextResponse.json({ error: expired ? "Your Instagram login expired. Connect again." : msg, expired }, { status: 502 });
  }
}

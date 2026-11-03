import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getMe } from "@/lib/supabase/server";
import { getMedia, photosOf, tokenFor } from "@/lib/instagram";

export const maxDuration = 60;
const MAX_AT_ONCE = 12;

/**
 * Copy the chosen Instagram photos into the creator's portfolio. Instagram's own photo links stop
 * working after a while, so each photo is downloaded, shrunk to WebP and saved in Rollshot storage.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getMe();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set(((body?.ids ?? []) as unknown[]).filter((x): x is string => typeof x === "string" && /^\d{5,30}$/.test(x)))];
  if (!ids.length) return NextResponse.json({ error: "Pick at least one photo" }, { status: 400 });
  if (ids.length > MAX_AT_ONCE) return NextResponse.json({ error: `Up to ${MAX_AT_ONCE} posts at a time` }, { status: 400 });
  const token = await tokenFor(supabase);
  if (!token) return NextResponse.json({ error: "Connect Instagram first" }, { status: 409 });

  const { data: pro } = await supabase.from("pros").select("photos").eq("id", user.id).single();
  const have = new Set(((pro?.photos ?? []) as string[]));
  const added: string[] = [];
  let failed = 0;
  for (const id of ids) {
    let photos: { id: string; url: string }[] = [];
    try {
      photos = photosOf(await getMedia(token, id));
    } catch {
      failed++;
      continue;
    }
    for (const ph of photos) {
      const path = `${user.id}/ig-${ph.id}.webp`;
      if (have.has(path) || added.includes(path)) continue; // already imported
      try {
        const res = await fetch(ph.url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(String(res.status));
        const webp = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        const { error } = await supabase.storage.from("portfolio").upload(path, webp, { contentType: "image/webp", cacheControl: "31536000" });
        // Already in storage from an earlier import: just put it back in the portfolio.
        if (error && !/exists|duplicate/i.test(error.message)) throw error;
        added.push(path);
      } catch {
        failed++;
      }
    }
  }
  if (added.length) {
    const { error } = await supabase.from("pros").update({ photos: [...have, ...added], updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ added: added.length, failed });
}

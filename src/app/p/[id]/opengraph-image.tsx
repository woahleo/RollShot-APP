import { loadPhoto, ogCard, OG_SIZE, publicClient } from "@/lib/og";
import { KIND_LABEL, photoUrl, proKey, type Kind } from "@/lib/types";

export const runtime = "nodejs";
export const alt = "A car creator on Rollshot";
export const size = OG_SIZE;
export const contentType = "image/png";

type Row = { city: string; kind: Kind | null; photos: string[]; profiles: { name: string; avatar: string | null } | null; packages: { price: number }[] };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = decodeURIComponent(id).toLowerCase();
  const { data } = await publicClient().from("pros").select("city, kind, photos, profiles(name, avatar), packages(price)").eq(proKey(key), key).maybeSingle();
  const p = data as unknown as Row | null;
  if (!p) return ogCard();
  // Their profile photo; without one, their cover photo; without either, the car sketch.
  const pic = p.profiles?.avatar ?? p.photos[0];
  const photo = await loadPhoto(pic ? photoUrl(pic) : null);
  const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
  return ogCard({
    eyebrow: KIND_LABEL[(p.kind ?? "photo") as Kind],
    title: p.profiles?.name ?? "Creator",
    lines: [`Car shoots in ${p.city}`, from ? `From $${from} · Book an open day` : "Book an open day"],
    photo,
  });
}

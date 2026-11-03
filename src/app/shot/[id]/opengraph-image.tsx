import { ogCard, OG_SIZE, publicClient } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "A car shoot booked on Rollshot";
export const size = OG_SIZE;
export const contentType = "image/png";

type Row = {
  car: string; city: string; shoot_type: string; price: number; hidden_by_owner: boolean;
  pro: { profiles: { name: string } | null } | null;
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await publicClient()
    .from("shoot_posts")
    .select("car, city, shoot_type, price, hidden_by_owner, pro:pros(profiles(name))")
    .eq("id", id)
    .maybeSingle();
  const s = data as unknown as Row | null;
  if (!s || s.hidden_by_owner) return ogCard();
  return ogCard({
    eyebrow: "Shot on Rollshot",
    title: s.car,
    lines: [`${s.shoot_type} · $${s.price} · ${s.city}`, `Shot by ${s.pro?.profiles?.name ?? "a Rollshot creator"}`],
  });
}

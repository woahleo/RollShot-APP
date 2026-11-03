import Link from "next/link";
import { KIND_LABEL, photoUrl, type Kind, type Package, type Pro, type ShootPost } from "@/lib/types";
import { prettyDate } from "@/lib/sun";
import { videoHost } from "@/lib/photos";

export type FeedShot = ShootPost & { pro: { kind: Kind; profiles: { name: string } | null } | null };
export type FeedPro = Pro & { profiles: { name: string } | null; packages: Package[] };

type Item = {
  key: string;
  href: string;
  img: string | null;
  proId: string;
  name: string;
  meta: string;
  title: string;
  note: string | null;
  price: string | null;
  badge: string | null;
  more: number;
};

/** Finished shoots first, newest first. Until there are enough, photographers' portfolio shots fill in. */
export function buildFeed(shots: FeedShot[], pros: FeedPro[], size = 12): Item[] {
  // At most two shoots per photographer, so one busy person never fills the feed.
  const perPro = new Map<string, number>();
  const picked = shots.filter((s) => {
    const n = (perPro.get(s.pro_id) ?? 0) + 1;
    perPro.set(s.pro_id, n);
    return n <= 2;
  });
  const items: Item[] = picked.slice(0, size).map((s) => ({
    key: `s-${s.id}`,
    href: `/shot/${s.id}`,
    img: s.photos[0] ? photoUrl(s.photos[0]) : null,
    proId: s.pro_id,
    name: s.pro?.profiles?.name ?? "Photographer",
    meta: `${s.city} · ${prettyDate(s.shoot_date)}`,
    title: s.car,
    note: s.caption,
    price: `${s.shoot_type} · $${s.price}`,
    badge: s.video_url ? videoHost(s.video_url) : null,
    more: Math.max(0, s.photos.length - 1),
  }));
  // Take one portfolio photo per photographer per round, so one person never fills the feed.
  const queue = pros.filter((p) => p.photos.length > 0);
  for (let round = 0; items.length < size && round < 4; round++) {
    for (const p of queue) {
      if (items.length >= size) break;
      const ph = p.photos[round];
      if (!ph) continue;
      const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
      items.push({
        key: `p-${p.id}-${round}`,
        href: `/p/${p.id}`,
        img: photoUrl(ph),
        proId: p.id,
        name: p.profiles?.name ?? "Photographer",
        meta: `${KIND_LABEL[(p.kind ?? "photo") as Kind]} · ${p.city}`,
        title: p.shoot_types.slice(0, 2).join(" · ") || "Portfolio",
        note: round === 0 ? p.about : null,
        price: from ? `From $${from}` : null,
        badge: null,
        more: 0,
      });
    }
  }
  return items;
}

/** The landing page feed: big photos, who shot them, and a way to book. */
export default function Feed({ items }: { items: Item[] }) {
  return (
    <div className="feed">
      {items.map((it) => (
        <article key={it.key} className="post">
          <header className="post-head">
            <Link href={`/p/${it.proId}`} className="post-who">
              <span className="avatar sm" aria-hidden="true">{it.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{it.name}</b>
                <small>{it.meta}</small>
              </span>
            </Link>
            <Link className="btn small" href={`/p/${it.proId}#book`}>Book</Link>
          </header>
          <Link href={it.href} className="post-media">
            {it.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.img} alt={`${it.title} by ${it.name}`} loading="lazy" />
            ) : (
              <span className="post-empty">{it.badge ?? "Video"}</span>
            )}
            {it.more > 0 && <span className="count">+{it.more}</span>}
            {it.badge && it.img && <span className="tag">{it.badge}</span>}
          </Link>
          <Link href={it.href} className="post-body">
            <div className="line">
              <b>{it.title}</b>
              {it.price && <span className="muted small">{it.price}</span>}
            </div>
            {it.note && <p className="small">{it.note}</p>}
          </Link>
        </article>
      ))}
    </div>
  );
}

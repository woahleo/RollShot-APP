import Link from "next/link";
import { KIND_LABEL, photoUrl, proPath, type Kind, type Package, type Pro, type ShootPost } from "@/lib/types";
import { prettyDate } from "@/lib/sun";
import { videoHost } from "@/lib/photos";
import Avatar from "./Avatar";

type Who = { name: string; avatar?: string | null } | null;
export type FeedShot = ShootPost & { pro: { kind: Kind; handle: string | null; profiles: Who } | null };
export type FeedPro = Pro & { profiles: Who; packages: Package[] };

type Item = {
  key: string;
  href: string;
  img: string | null;
  proHref: string;
  name: string;
  avatar: string | null;
  meta: string;
  title: string;
  note: string | null;
  price: string | null;
  badge: string | null;
  more: number;
};

/**
 * One post per photographer, so the feed reads as a lineup instead of a photo dump.
 * Each one shows their newest finished shoot, or, until they have one, the cover photo
 * they picked for their portfolio. Photographers with recent shoots come first.
 */
export function buildFeed(shots: FeedShot[], pros: FeedPro[], size = 9): Item[] {
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const s of shots) {
    if (seen.has(s.pro_id) || items.length >= size) continue;
    seen.add(s.pro_id);
    const name = s.pro?.profiles?.name ?? "Photographer";
    items.push({
      key: `s-${s.id}`,
      href: `/shot/${s.id}`,
      img: s.photos[0] ? photoUrl(s.photos[0]) : null,
      proHref: proPath({ id: s.pro_id, handle: s.pro?.handle }),
      name,
      avatar: s.pro?.profiles?.avatar ?? null,
      meta: `${s.city} · ${prettyDate(s.shoot_date)}`,
      title: s.car,
      note: s.caption,
      price: `${s.shoot_type} · $${s.price}`,
      badge: s.video_url ? videoHost(s.video_url) : null,
      more: Math.max(0, s.photos.length - 1),
    });
  }
  for (const p of pros) {
    if (seen.has(p.id) || !p.photos[0] || items.length >= size) continue;
    seen.add(p.id);
    const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
    const href = proPath(p);
    items.push({
      key: `p-${p.id}`,
      href,
      img: photoUrl(p.photos[0]),
      proHref: href,
      name: p.profiles?.name ?? "Photographer",
      avatar: p.profiles?.avatar ?? null,
      meta: `${KIND_LABEL[(p.kind ?? "photo") as Kind]} · ${p.city}`,
      title: p.shoot_types.slice(0, 2).join(" · ") || "Portfolio",
      note: p.about,
      price: from ? `From $${from}` : null,
      badge: null,
      more: Math.max(0, p.photos.length - 1),
    });
  }
  return items;
}

/** The landing page feed: one big photo per photographer, who shot it, and a way to book. */
export default function Feed({ items }: { items: Item[] }) {
  return (
    <div className="feed">
      {items.map((it) => (
        <article key={it.key} className="post">
          <header className="post-head">
            <Link href={it.proHref} className="post-who">
              <Avatar name={it.name} avatar={it.avatar} size={32} />
              <span>
                <b>{it.name}</b>
                <small>{it.meta}</small>
              </span>
            </Link>
            <Link className="btn small" href={`${it.proHref}#book`}>Book</Link>
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

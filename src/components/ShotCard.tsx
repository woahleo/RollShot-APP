import Link from "next/link";
import { money } from "@/lib/money";
import { photoUrl, type ShootPost } from "@/lib/types";
import { videoHost } from "@/lib/photos";

export type ShotRow = ShootPost & { pro?: { profiles: { name: string } | null } | null };

/** A finished shoot: the first photo, the car, and who shot it. */
export default function ShotCard({ s, showPro = true }: { s: ShotRow; showPro?: boolean }) {
  const name = s.pro?.profiles?.name;
  return (
    <Link href={`/shot/${s.id}`} className="pro-card shot-card">
      <div className="media">
        {s.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="cover" src={photoUrl(s.photos[0])} alt={`${s.shoot_type}, ${s.car}`} loading="lazy" />
        ) : (
          <div className="cover empty"><span>{s.video_url ? videoHost(s.video_url) : "No photos"}</span></div>
        )}
        {s.photos.length > 1 && <span className="count">{s.photos.length} photos</span>}
        {s.video_url && <span className="tag">{videoHost(s.video_url)}</span>}
      </div>
      <div className="body">
        <div className="line">
          <h3>{s.car}</h3>
          <span className="from">{money(s.price)}</span>
        </div>
        <span className="muted small">{s.shoot_type} · {s.city}{showPro && name ? ` · ${name}` : ""}</span>
      </div>
    </Link>
  );
}

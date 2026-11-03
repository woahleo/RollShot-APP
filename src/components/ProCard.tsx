import Link from "next/link";
import { prettyDate, today } from "@/lib/sun";
import { KIND_LABEL, photoUrl, type Kind, type Package, type Pro } from "@/lib/types";

export type ProRow = Pro & { profiles: { name: string } | null; packages: Package[] };

/** Photo-first card for a photographer: cover, name, starting price, next open day. */
export default function ProCard({ p, href }: { p: ProRow; href?: string }) {
  const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
  const next = p.open_dates.filter((d) => d >= today()).sort()[0];
  return (
    <Link href={href ?? `/p/${p.id}`} className="pro-card">
      <div className="media">
        {p.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="cover" src={photoUrl(p.photos[0])} alt="" loading="lazy" />
        ) : (
          <div className="cover empty"><span>No photos yet</span></div>
        )}
        {next && <span className="tag"><i className="sun" aria-hidden="true" /> Open {prettyDate(next)}</span>}
      </div>
      <div className="body">
        <div className="line">
          <h3>{p.profiles?.name ?? "Photographer"}</h3>
          {from && <span className="from">From <b>${from}</b></span>}
        </div>
        <span className="muted small">{KIND_LABEL[(p.kind ?? "photo") as Kind]} · {p.city}</span>
        {p.shoot_types.length > 0 && <span className="muted small">{p.shoot_types.slice(0, 3).join(" · ")}</span>}
      </div>
    </Link>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CITIES, KIND_LABEL, photoUrl, type Kind, type Package, type Pro } from "@/lib/types";
import { goldenHour, prettyDate, today } from "@/lib/sun";

type Row = Pro & { profiles: { name: string } | null; packages: Package[] };

const KINDS: { key: string; label: string }[] = [
  { key: "", label: "Everyone" },
  { key: "photo", label: "Photographers" },
  { key: "video", label: "Videographers" },
];

export default async function Book({ searchParams }: { searchParams: Promise<{ city?: string; kind?: string }> }) {
  const { city, kind } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("pros").select("*, profiles(name), packages(*)").order("updated_at", { ascending: false });
  if (city && (CITIES as readonly string[]).includes(city)) q = q.eq("city", city);
  if (kind === "photo" || kind === "video") q = q.in("kind", [kind, "both"]);
  const { data } = await q;
  const pros = (data ?? []) as Row[];
  const now = today();
  const href = (c?: string, k?: string) => {
    const p = new URLSearchParams();
    if (c) p.set("city", c);
    if (k) p.set("kind", k);
    const s = p.toString();
    return s ? `/book?${s}` : "/book";
  };

  return (
    <main className="wrap">
      <h1>Find a <em>shooter.</em></h1>
      <p className="lede">Pick a photographer or videographer, then tap Book now on their page.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {KINDS.map((k) => (
          <Link key={k.key} className="chip" aria-pressed={(kind ?? "") === k.key} href={href(city, k.key)}>{k.label}</Link>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 20 }}>
        <Link className="chip" aria-pressed={!city} href={href(undefined, kind)}>All cities</Link>
        {CITIES.map((c) => (
          <Link key={c} className="chip" aria-pressed={city === c} href={href(c, kind)}>{c}</Link>
        ))}
      </div>
      {pros.length === 0 && (
        <p className="notice">No one matches yet. Check back soon, or <Link href="/signup?role=pro">join as a shooter</Link>.</p>
      )}
      <div className="grid">
        {pros.map((p) => {
          const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
          const next = p.open_dates.filter((d) => d >= now).sort()[0];
          return (
            <Link key={p.id} href={`/p/${p.id}#book`} className="card pro-card">
              {p.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cover" src={photoUrl(p.photos[0])} alt="" loading="lazy" />
              ) : (
                <div className="cover" />
              )}
              <div className="body">
                <span className="eyebrow">{KIND_LABEL[(p.kind ?? "photo") as Kind]} · {p.city}</span>
                <h3>{p.profiles?.name ?? "Shooter"}</h3>
                {p.shoot_types.length > 0 && <span className="muted small">{p.shoot_types.slice(0, 3).join(", ")}</span>}
                <span className="small">
                  {from ? `From $${from}` : "No packages yet"}
                  {next ? ` · Next open ${prettyDate(next)}, golden hour ${goldenHour(next)}` : " · No open dates yet"}
                </span>
                <span className="btn pink small" style={{ justifySelf: "start", marginTop: 8 }}>Book now</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

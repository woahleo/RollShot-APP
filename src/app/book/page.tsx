import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CITIES, photoUrl, type Package, type Pro } from "@/lib/types";
import { goldenHour, prettyDate, today } from "@/lib/sun";

type Row = Pro & { profiles: { name: string } | null; packages: Package[] };

export default async function Book({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("pros").select("*, profiles(name), packages(*)").order("updated_at", { ascending: false });
  if (city && (CITIES as readonly string[]).includes(city)) q = q.eq("city", city);
  const { data } = await q;
  const pros = (data ?? []) as Row[];
  const now = today();

  return (
    <main className="wrap">
      <h1>Find a <em>shooter.</em></h1>
      <div className="chips" style={{ marginBottom: 20 }}>
        <Link className="chip" aria-pressed={!city} href="/book">All</Link>
        {CITIES.map((c) => (
          <Link key={c} className="chip" aria-pressed={city === c} href={`/book?city=${encodeURIComponent(c)}`}>{c}</Link>
        ))}
      </div>
      {pros.length === 0 && (
        <p className="notice">No shooters here yet. Check back soon, or <Link href="/signup?role=pro">join as one</Link>.</p>
      )}
      <div className="grid">
        {pros.map((p) => {
          const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
          const next = p.open_dates.filter((d) => d >= now).sort()[0];
          return (
            <Link key={p.id} href={`/p/${p.id}`} className="card pro-card">
              {p.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cover" src={photoUrl(p.photos[0])} alt="" loading="lazy" />
              ) : (
                <div className="cover" />
              )}
              <div className="body">
                <h3>{p.profiles?.name ?? "Shooter"}</h3>
                <span className="muted small">
                  {p.city}
                  {p.shoot_types.length ? ` · ${p.shoot_types.slice(0, 2).join(", ")}` : ""}
                </span>
                <span className="small">
                  {from ? `From $${from}` : "Packages coming"}
                  {next ? ` · Next open ${prettyDate(next)}, golden hour ${goldenHour(next)}` : ""}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

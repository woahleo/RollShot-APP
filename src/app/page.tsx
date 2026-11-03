import Link from "next/link";
import SignedInAs from "@/components/SignedInAs";
import { accountLabel } from "@/lib/account";
import { goldenHour, today } from "@/lib/sun";
import { getMe } from "@/lib/supabase/server";
import { KIND_LABEL, photoUrl, type Kind, type Package, type Pro } from "@/lib/types";

type Featured = Pro & { profiles: { name: string } | null; packages: Package[] };

const STEPS = [
  { n: "01", title: "Pick your photographer", body: "Browse local photographers and videographers by city, style and price." },
  { n: "02", title: "Choose a golden hour date", body: "Every open day shows its golden hour, so your paint looks its best." },
  { n: "03", title: "Shoot, then share", body: "Chat once you book. If it rains, move the shoot for free." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { supabase, user, profile } = await getMe();
  const label = await accountLabel(supabase, profile);
  const { data } = await supabase
    .from("pros")
    .select("*, profiles(name), packages(*)")
    .neq("photos", "{}")
    .order("updated_at", { ascending: false })
    .limit(3);
  const featured = (data ?? []) as Featured[];
  const day = today();

  return (
    <main>
      <section className="wrap hero">
        <div className="hero-text">
          {deleted && <p className="notice">Your account was deleted.</p>}
          <p className="eyebrow">West Palm Beach · Boca · Fort Lauderdale · Miami</p>
          <h1 className="hero-title">Your car, shot <em>right.</em></h1>
          <p className="lede">Book local car photographers and videographers by the shoot. Real portfolios, golden hour dates, no back and forth.</p>
          <p className="golden"><span className="sun" aria-hidden="true" /> Golden hour today in West Palm · {goldenHour(day)}</p>
          {user ? (
            <SignedInAs profile={profile} label={label} email={user.email ?? ""} wanted={null} />
          ) : (
            <div className="row" style={{ marginTop: 8 }}>
              <Link className="btn pink" href="/signup?role=client">Book a photographer</Link>
              <Link className="btn" href="/signup?role=pro">I shoot cars</Link>
            </div>
          )}
        </div>
        <div className="viewfinder" aria-hidden="true">
          <span className="vf-c tl" /><span className="vf-c tr" /><span className="vf-c bl" /><span className="vf-c br" />
          <div className="vf-hud vf-top"><span><i className="rec" /> REC</span><span>4K · 24</span></div>
          <svg className="vf-car" viewBox="0 0 300 110" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
            <path d="M18 80 L24 66 Q30 60 62 56 L102 38 Q116 32 146 32 L180 33 Q204 35 222 49 L252 55 Q276 59 283 70 L285 80" />
            <path d="M18 80 H62 M98 80 H214 M250 80 H285" />
            <path d="M108 54 L124 40 Q132 37 146 37 L176 38 Q194 40 206 52 Z" />
            <path d="M156 38 L154 53" />
            <circle cx="80" cy="80" r="17" /><circle cx="80" cy="80" r="7" />
            <circle cx="232" cy="80" r="17" /><circle cx="232" cy="80" r="7" />
          </svg>
          <div className="vf-focus" />
          <div className="vf-hud vf-bottom"><span>f/2.8</span><span>1/250</span><span>ISO 100</span></div>
        </div>
      </section>

      <section className="wrap section">
        <p className="eyebrow">How it works</p>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p className="muted small">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="wrap section">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Shooting this week</p>
            <Link className="small" href="/book">See everyone</Link>
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            {featured.map((p) => {
              const from = p.packages.length ? Math.min(...p.packages.map((k) => k.price)) : null;
              return (
                <Link key={p.id} href={`/p/${p.id}`} className="card pro-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="cover" src={photoUrl(p.photos[0])} alt="" loading="lazy" />
                  <div className="body">
                    <span className="eyebrow">{KIND_LABEL[(p.kind ?? "photo") as Kind]} · {p.city}</span>
                    <h3>{p.profiles?.name}</h3>
                    {from && <span className="small">From ${from}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="band">
        <div className="wrap band-inner">
          <div>
            <p className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>For photographers and videographers</p>
            <h2 style={{ margin: "4px 0 8px" }}>Shoot cars. <em>Get booked.</em></h2>
            <p style={{ margin: 0, opacity: 0.8, maxWidth: "46ch" }}>Post your open days and packages once. Car owners near you book the date, and you only share your number after you accept.</p>
          </div>
          {!user && <Link className="btn pink" href="/signup?role=pro">Join as a photographer</Link>}
        </div>
      </section>

      <footer className="wrap foot small muted">
        <span>Rollshot · South Florida</span>
        <Link href="/book">Find a photographer</Link>
      </footer>
    </main>
  );
}

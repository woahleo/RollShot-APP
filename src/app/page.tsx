import Link from "next/link";
import SignedInAs from "@/components/SignedInAs";
import { accountLabel } from "@/lib/account";
import { goldenHour, today } from "@/lib/sun";
import { getMe } from "@/lib/supabase/server";
import { photoUrl } from "@/lib/types";
import ProCard, { type ProRow } from "@/components/ProCard";

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
  const featured = (data ?? []) as ProRow[];
  const day = today();
  // The hero shows real work from a photographer on Rollshot when there is some.
  const cover = featured.find((p) => p.photos.length > 0);

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
        <figure className={`viewfinder${cover ? " has-photo" : ""}`}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="vf-photo" src={photoUrl(cover.photos[0])} alt={`Car shot by ${cover.profiles?.name ?? "a Rollshot photographer"}`} />
          )}
          <span className="vf-c tl" /><span className="vf-c tr" /><span className="vf-c bl" /><span className="vf-c br" />
          <div className="vf-hud vf-top" aria-hidden="true"><span><i className="rec" /> REC</span><span>4K · 24</span></div>
          {!cover && (
            <svg className="vf-car" aria-hidden="true" viewBox="0 0 300 110" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
              <path d="M18 80 L24 66 Q30 60 62 56 L102 38 Q116 32 146 32 L180 33 Q204 35 222 49 L252 55 Q276 59 283 70 L285 80" />
              <path d="M18 80 H62 M98 80 H214 M250 80 H285" />
              <path d="M108 54 L124 40 Q132 37 146 37 L176 38 Q194 40 206 52 Z" />
              <path d="M156 38 L154 53" />
              <circle cx="80" cy="80" r="17" /><circle cx="80" cy="80" r="7" />
              <circle cx="232" cy="80" r="17" /><circle cx="232" cy="80" r="7" />
            </svg>
          )}
          <div className="vf-focus" aria-hidden="true" />
          <div className="vf-hud vf-bottom" aria-hidden="true"><span>f/2.8</span><span>1/250</span><span>ISO 100</span></div>
          {cover && (
            <figcaption><Link href={`/p/${cover.id}`}>Shot by {cover.profiles?.name} · {cover.city}</Link></figcaption>
          )}
        </figure>
      </section>

      <section className="wrap section">
        <h2 style={{ marginTop: 0 }}>How it works<em>.</em></h2>
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
            <h2 style={{ margin: 0 }}>Shooting this week<em>.</em></h2>
            <Link className="small" href="/book">See everyone</Link>
          </div>
          <div className="grid pros" style={{ marginTop: 16 }}>
            {featured.map((p) => <ProCard key={p.id} p={p} />)}
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

      <footer className="wrap foot small">
        <div>
          <span className="logo">Rollshot</span>
          <p className="muted" style={{ margin: "6px 0 0" }}>Car photographers and videographers in South Florida.</p>
        </div>
        <nav className="foot-links">
          <Link href="/book">Photographers</Link>
          <Link href="/requests">Requests</Link>
          <Link href="/signup?role=pro">Shoot for Rollshot</Link>
        </nav>
      </footer>
    </main>
  );
}

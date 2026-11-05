import Link from "next/link";
import SignedInAs from "@/components/SignedInAs";
import { accountLabel } from "@/lib/account";
import { getMe } from "@/lib/supabase/server";
import { MIN_PHOTOS, photoUrl, proPath } from "@/lib/types";
import { type ProRow } from "@/components/ProCard";
import Feed, { buildFeed, type FeedShot } from "@/components/Feed";
import ClientHome from "@/components/home/ClientHome";
import ProHome from "@/components/home/ProHome";
import HeroSlides, { type Slide } from "@/components/HeroSlides";

const STEPS = [
  { n: "01", title: "Pick your creator", body: "Browse local photo and video creators by city, style and price." },
  { n: "02", title: "Pick an open day", body: "See the days they're free and book one. No back and forth." },
  { n: "03", title: "Shoot, then share", body: "Chat once you book. If it rains, move the shoot for free." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { supabase, user, profile } = await getMe();
  // Signed in: your own home feed, different for car owners and creators.
  if (user && profile) {
    return profile.role === "pro"
      ? <ProHome supabase={supabase} userId={user.id} profile={profile} />
      : <ClientHome supabase={supabase} userId={user.id} profile={profile} />;
  }
  const label = await accountLabel(supabase, profile);
  const { data } = await supabase
    .from("pros")
    .select("*, profiles(name, avatar), packages(*)")
    .gte("photo_count", MIN_PHOTOS)
    .order("updated_at", { ascending: false })
    .limit(24);
  const featured = (data ?? []) as ProRow[];
  const { data: shotRows } = await supabase
    .from("shoot_posts")
    .select("*, pro:pros(kind, handle, profiles(name, avatar))")
    .eq("hidden_by_owner", false)
    .order("created_at", { ascending: false })
    .limit(24);
  const shots = (shotRows ?? []) as unknown as FeedShot[];
  // Real shoots first; until there are enough, creators' portfolio shots fill the feed.
  const feed = buildFeed(shots, featured, 9);
  // The hero cycles through creators' photos in a random order, so a different creator's work shows
  // every few seconds. Creators are shuffled, then their photos are dealt out in turns so the same
  // creator never shows twice in a row (unless they're the only one).
  const slides = heroSlides(featured, shots);
  const cover = slides.length > 0;

  return (
    <main>
      <section className="wrap hero">
        <div className="hero-text">
          {deleted && <p className="notice">Your account was deleted.</p>}
          <p className="eyebrow">Miami · Los Angeles · New York · Houston · Atlanta · and more</p>
          <h1 className="hero-title">Your car, shot <em>right.</em></h1>
          <p className="lede">Book local car photo and video creators by the shoot. Real portfolios, real open dates, no back and forth.</p>
          {user ? (
            <SignedInAs profile={profile} label={label} email={user.email || (user.phone ? `+${user.phone}` : "")} wanted={null} />
          ) : (
            <div className="row" style={{ marginTop: 8 }}>
              <Link className="btn pink" href="/signup?role=client">Book a creator</Link>
              <Link className="btn" href="/signup?role=pro">I shoot cars</Link>
            </div>
          )}
        </div>
        <figure className={`viewfinder${cover ? " has-photo" : ""}`}>
          <HeroSlides slides={slides} />
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
          <div className="vf-hud vf-bottom" aria-hidden="true"><span>f/2.8</span><span>1/250</span><span>ISO 100</span></div>
        </figure>
      </section>

      {feed.length > 0 && (
        <section className="wrap section" id="feed">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0 }}>Fresh off the street<em>.</em></h2>
            <Link className="small" href="/book">See everyone</Link>
          </div>
          <p className="lede" style={{ margin: "8px 0 0" }}>
            {shots.length ? "One post per creator: their latest shoot on Rollshot, or the best shot from their portfolio." : "One photo per creator, the best from their portfolio. Tap one to see the rest."}
          </p>
          <Feed items={feed} />
          <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
            <Link className="btn" href="/book">See all creators</Link>
          </div>
        </section>
      )}

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

      <section className="band">
        <div className="wrap band-inner">
          <div>
            <p className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>For photo and video creators</p>
            <h2 style={{ margin: "4px 0 8px" }}>Shoot cars. <em>Get booked.</em></h2>
            <p style={{ margin: 0, opacity: 0.8, maxWidth: "46ch" }}>Post your open days and packages once. Car owners near you book the date, and you only share your number after you accept.</p>
          </div>
          {!user && <Link className="btn pink" href="/signup?role=pro">Join as a creator</Link>}
        </div>
      </section>

      <footer className="wrap foot small">
        <div>
          <span className="logo">Rollshot</span>
          <p className="muted" style={{ margin: "6px 0 0" }}>Car photo and video creators across the US.</p>
        </div>
        <nav className="foot-links">
          <Link href="/book">Creators</Link>
          <Link href="/requests">Requests</Link>
          <Link href="/signup?role=pro">Shoot for Rollshot</Link>
        </nav>
      </footer>
    </main>
  );
}

function shuffle<T>(a: T[]) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** Up to 16 photos from creators' portfolios and posted shoots, in a random order, one creator at a time. */
function heroSlides(pros: ProRow[], shots: FeedShot[], max = 16): Slide[] {
  const byPro = new Map<string, Slide[]>();
  for (const p of pros) {
    const href = proPath(p);
    const list = p.photos.map((ph) => ({ src: photoUrl(ph), name: p.profiles?.name ?? "a Rollshot creator", city: p.city, href }));
    byPro.set(p.id, list);
  }
  for (const s of shots) {
    const list = byPro.get(s.pro_id) ?? [];
    for (const ph of s.photos) list.push({ src: photoUrl(ph), name: s.pro?.profiles?.name ?? "a Rollshot creator", city: s.city, href: `/shot/${s.id}` });
    byPro.set(s.pro_id, list);
  }
  const queues = shuffle([...byPro.values()].filter((l) => l.length)).map((l) => shuffle(l));
  const out: Slide[] = [];
  const seen = new Set<string>();
  while (out.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && !seen.has(next.src)) { seen.add(next.src); out.push(next); }
      if (out.length >= max) break;
    }
  }
  return out;
}

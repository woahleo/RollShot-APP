import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import Feed from "@/components/Feed";
import DateTile from "@/components/DateTile";
import Avatar from "@/components/Avatar";
import { loadFeed } from "@/lib/feed";
import { prettyTime } from "@/lib/hours";
import { today } from "@/lib/sun";
import type { Booking, Profile } from "@/lib/types";

type Next = Booking & { pro: { handle: string | null; profiles: { name: string; avatar: string | null } | null } | null };
type Req = { id: string; car: string; shoot_type: string; date_from: string; city: string };

const STATUS: Record<string, string> = { requested: "Waiting for them to accept", confirmed: "Confirmed", rescheduled: "Rain checked" };

/** A car owner's home: what's coming up, offers waiting on them, then the feed. */
export default async function ClientHome({ supabase, userId, profile }: { supabase: SupabaseClient; userId: string; profile: Profile }) {
  const now = today();
  const [{ data: nextRows }, { data: reqRows }, feed] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, pro:pros(handle, profiles(name, avatar))")
      .eq("client_id", userId)
      .gte("shoot_date", now)
      .in("status", ["requested", "confirmed", "rescheduled"])
      .order("shoot_date")
      .limit(3),
    supabase.from("requests").select("id, car, shoot_type, date_from, city").eq("client_id", userId).eq("status", "open").gte("date_to", now).order("date_from").limit(3),
    loadFeed(supabase),
  ]);
  const next = (nextRows ?? []) as unknown as Next[];
  const reqs = (reqRows ?? []) as Req[];
  const { data: counts } = reqs.length ? await supabase.rpc("request_reply_counts", { p_ids: reqs.map((r) => r.id) }) : { data: [] };
  const offers = new Map(((counts ?? []) as { request_id: string; replies: number }[]).map((c) => [c.request_id, Number(c.replies)]));
  const first = profile.name.split(" ")[0] || "there";

  return (
    <main>
      <section className="wrap home-head">
        <h1>Hey {first}<em>.</em></h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn solid small" href="/book">Find a creator</Link>
          <Link className="btn small" href="/requests/new">Post a request</Link>
        </div>
      </section>

      {(next.length > 0 || reqs.length > 0) && (
        <section className="wrap">
          <div className="todo">
            {next.map((b) => {
              const name = b.pro?.profiles?.name ?? "Creator";
              return (
                <Link key={b.id} href="/shoots" className="card todo-item">
                  <DateTile day={b.shoot_date} />
                  <div style={{ minWidth: 0 }}>
                    <span className="eyebrow">{STATUS[b.status] ?? "Coming up"}</span>
                    <b>{b.package_name} with {name}</b>
                    <span className="small muted">{[b.shoot_time ? prettyTime(b.shoot_time) : null, b.car].filter(Boolean).join(" · ")}</span>
                  </div>
                  <Avatar name={name} avatar={b.pro?.profiles?.avatar} size={36} />
                </Link>
              );
            })}
            {reqs.map((r) => {
              const n = offers.get(r.id) ?? 0;
              return (
                <Link key={r.id} href={`/requests/${r.id}`} className={`card todo-item${n > 0 ? " hot" : ""}`}>
                  <DateTile day={r.date_from} />
                  <div style={{ minWidth: 0 }}>
                    <span className="eyebrow">Your request</span>
                    <b>{r.shoot_type} · {r.car}</b>
                    <span className="small muted">{n > 0 ? `${n} offer${n === 1 ? "" : "s"} to compare` : `${r.city} · no offers yet`}</span>
                  </div>
                  <span className="todo-go">{n > 0 ? "Compare" : "View"}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {next.length === 0 && reqs.length === 0 && (
        <section className="wrap">
          <p className="notice">Nothing booked yet. Pick a creator below, or post your date and let them send you offers.</p>
        </section>
      )}

      <section className="wrap section" id="feed" style={{ paddingTop: 28 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Fresh off the street<em>.</em></h2>
          <Link className="small" href="/book">See everyone</Link>
        </div>
        <p className="lede" style={{ margin: "8px 0 0" }}>One post per creator: their latest shoot, or their best shot. Tap Book on anyone.</p>
        {feed.items.length ? <Feed items={feed.items} /> : <p className="muted">No photos yet.</p>}
      </section>
      <HomeFoot />
    </main>
  );
}

export function HomeFoot() {
  return (
    <footer className="wrap foot small">
      <div>
        <span className="logo">Rollshot</span>
        <p className="muted" style={{ margin: "6px 0 0" }}>Car photo and video creators across the US.</p>
      </div>
      <nav className="foot-links">
        <Link href="/book">Creators</Link>
        <Link href="/requests">Requests</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </footer>
  );
}


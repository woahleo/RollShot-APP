import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import Feed from "@/components/Feed";
import DateTile from "@/components/DateTile";
import { loadFeed } from "@/lib/feed";
import { prettyTime } from "@/lib/hours";
import { prettyDate, today } from "@/lib/sun";
import { proPath, type Booking, type Profile, type Pro } from "@/lib/types";
import { HomeFoot } from "./ClientHome";

type Req = { id: string; car: string; city: string; shoot_type: string; kind: string; date_from: string; date_to: string; budget: number | null; note: string | null };
type B = Booking & { client: { name: string } | null };

const KIND: Record<string, string> = { photo: "Photos", video: "Video", either: "Photo or video" };

/**
 * A photographer's home: what needs them today, car owners looking for a shoot (their city first),
 * then what everyone else on Rollshot is shooting.
 */
export default async function ProHome({ supabase, userId, profile }: { supabase: SupabaseClient; userId: string; profile: Profile }) {
  const now = today();
  const [{ data: me }, { data: bookingRows }, { count: pkgCount }, { data: postRows }, { data: reqRows }, { data: myReplies }, feed] = await Promise.all([
    supabase.from("pros").select("*").eq("id", userId).single(),
    supabase.from("bookings").select("*, client:profiles!bookings_client_id_fkey(name)").eq("pro_id", userId).order("shoot_date"),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("pro_id", userId),
    supabase.from("shoot_posts").select("booking_id").eq("pro_id", userId),
    supabase.from("requests").select("id, car, city, shoot_type, kind, date_from, date_to, budget, note").eq("status", "open").gte("date_to", now).order("created_at", { ascending: false }).limit(30),
    supabase.from("request_replies").select("request_id, price").eq("pro_id", userId),
    loadFeed(supabase, { skipPro: userId, size: 6 }),
  ]);
  const pro = me as Pro;
  const rows = (bookingRows ?? []) as B[];
  const posted = new Set(((postRows ?? []) as { booking_id: string }[]).map((p) => p.booking_id));
  const asks = rows.filter((b) => b.status === "requested" && b.shoot_date >= now);
  const nextShoot = rows.find((b) => (b.status === "confirmed" || b.status === "rescheduled") && b.shoot_date >= now);
  const toPost = rows.filter((b) => (b.status === "confirmed" || b.status === "rescheduled") && b.shoot_date <= now && !posted.has(b.id));
  const offered = new Map(((myReplies ?? []) as { request_id: string; price: number | null }[]).map((r) => [r.request_id, r.price]));
  // Requests in their own city first, then everything else, newest first within each.
  const reqs = ((reqRows ?? []) as Req[]).sort((a, b) => Number(b.city === pro.city) - Number(a.city === pro.city)).slice(0, 6);
  const openDays = pro.open_dates.filter((d) => d >= now).length;
  const missing = [
    !pro.photos.length && { href: "/pro#photos", text: "Add photos so car owners can see your work" },
    !pkgCount && { href: "/pro/edit", text: "Add a package with a price so people can book you" },
    !openDays && { href: "/pro#dates", text: "Open some days on your calendar" },
  ].filter(Boolean) as { href: string; text: string }[];
  const first = profile.name.split(" ")[0] || "there";

  return (
    <main>
      <section className="wrap home-head">
        <h1>Hey {first}<em>.</em></h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn solid small" href="/pro">Dashboard</Link>
          <Link className="btn small" href={proPath({ id: userId, handle: pro.handle })}>View my page</Link>
        </div>
      </section>

      <section className="wrap">
        <div className="todo">
          {asks.length > 0 && (
            <Link href="/pro" className="card todo-item hot">
              <span className="todo-n">{asks.length}</span>
              <div style={{ minWidth: 0 }}>
                <span className="eyebrow">Needs you</span>
                <b>{asks.length === 1 ? "New booking request" : `${asks.length} new booking requests`}</b>
                <span className="small muted">{asks.slice(0, 2).map((b) => `${b.client?.name ?? "Client"} · ${prettyDate(b.shoot_date)}`).join(", ")}</span>
              </div>
              <span className="todo-go">Answer</span>
            </Link>
          )}
          {nextShoot && (
            <Link href="/pro" className="card todo-item">
              <DateTile day={nextShoot.shoot_date} />
              <div style={{ minWidth: 0 }}>
                <span className="eyebrow">Next shoot</span>
                <b>{nextShoot.package_name} with {nextShoot.client?.name ?? "Client"}</b>
                <span className="small muted">{[nextShoot.shoot_time ? prettyTime(nextShoot.shoot_time) : null, nextShoot.car].filter(Boolean).join(" · ")}</span>
              </div>
            </Link>
          )}
          {toPost.length > 0 && (
            <Link href={`/pro/post/${toPost[0].id}`} className="card todo-item">
              <span className="todo-n">{toPost.length}</span>
              <div style={{ minWidth: 0 }}>
                <span className="eyebrow">Post your work</span>
                <b>{toPost.length === 1 ? "A shoot is waiting on photos" : `${toPost.length} shoots are waiting on photos`}</b>
                <span className="small muted">Posting puts it in the feed with a Book button on it.</span>
              </div>
              <span className="todo-go">Post</span>
            </Link>
          )}
          {missing.map((m) => (
            <Link key={m.href + m.text} href={m.href} className="card todo-item">
              <span className="todo-n">!</span>
              <div style={{ minWidth: 0 }}>
                <span className="eyebrow">Finish your profile</span>
                <b>{m.text}</b>
              </div>
              <span className="todo-go">Fix</span>
            </Link>
          ))}
          {!asks.length && !nextShoot && !toPost.length && !missing.length && (
            <p className="notice" style={{ margin: 0 }}>You&apos;re all caught up. {openDays} open day{openDays === 1 ? "" : "s"} on your calendar.</p>
          )}
        </div>
      </section>

      <section className="wrap section" style={{ paddingTop: 28 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Car owners looking<em>.</em></h2>
          <Link className="small" href="/requests">See all requests</Link>
        </div>
        <p className="lede" style={{ margin: "8px 0 16px" }}>People who posted a date. Send an offer and they pick who shoots it. {pro.city} first.</p>
        {reqs.length === 0 ? (
          <p className="muted">No open requests right now. They show up here as soon as someone posts.</p>
        ) : (
          <div className="grid">
            {reqs.map((r) => {
              const mine = offered.has(r.id);
              return (
                <Link key={r.id} href={`/requests/${r.id}`} className="card req req-link">
                  <div className="req-top">
                    <DateTile day={r.date_from} />
                    <div style={{ minWidth: 0 }}>
                      <span className="eyebrow">{r.shoot_type} · {KIND[r.kind] ?? r.kind}</span>
                      <h3>{r.car}</h3>
                      <span className="small muted">{r.city}{r.budget ? ` · $${r.budget} budget` : ""}</span>
                    </div>
                  </div>
                  {r.note && <p className="small req-note">{r.note}</p>}
                  <div className="req-foot">
                    <span className="small muted">{r.city === pro.city ? "In your city" : "Nearby"}</span>
                    <span className={mine ? "badge confirmed" : "todo-go"}>{mine ? `You offered${offered.get(r.id) ? ` $${offered.get(r.id)}` : ""}` : "Send an offer"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {feed.items.length > 0 && (
        <section className="wrap section">
          <h2 style={{ margin: 0 }}>What others are shooting<em>.</em></h2>
          <p className="lede" style={{ margin: "8px 0 0" }}>The latest from other photographers on Rollshot.</p>
          <Feed items={feed.items} />
        </section>
      )}
      <HomeFoot />
    </main>
  );
}

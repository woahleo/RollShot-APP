import Link from "next/link";
import DateTile from "@/components/DateTile";
import { getMe } from "@/lib/supabase/server";
import { Suspense } from "react";
import { cityLabel, isCity } from "@/lib/cities";
import CityFilter from "@/components/CityFilter";
import { today } from "@/lib/sun";
import RequestActions from "./RequestActions";
import { lateCancels, lateLabel } from "@/lib/lateCancels";

export type Request = {
  id: string; client_id: string; car: string; city: string; kind: "photo" | "video" | "either"; shoot_type: string;
  date_from: string; date_to: string; budget: number | null; free?: boolean; note: string | null; status: "open" | "closed"; created_at: string;
  chosen_pro: string | null;
};

const KIND = { photo: "Photos", video: "Video", either: "Photo or video" } as const;
const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function ago(ts: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default async function Requests({ searchParams }: { searchParams: Promise<{ city?: string; posted?: string }> }) {
  const { city: picked, posted } = await searchParams;
  const { supabase, user, profile } = await getMe();
  // Creators start on their own cities; anyone can switch to another city or all of them.
  const { data: myPro } = profile?.role === "pro" && user ? await supabase.from("pros").select("all_cities").eq("id", user.id).maybeSingle() : { data: null };
  const myCities = ((myPro as { all_cities: string[] } | null)?.all_cities ?? []).filter(isCity);
  const showMine = myCities.length > 1 && (picked === "mine" || !picked);
  const city = isCity(picked) ? picked : picked === "all" || showMine ? undefined : myCities[0];
  // West Coast "today", so a request doesn't drop off the board while it's still that day there.
  let q = supabase.from("requests").select("*").eq("status", "open").gte("date_to", today("America/Los_Angeles")).order("created_at", { ascending: false }).limit(60);
  if (city) q = q.eq("city", city);
  else if (showMine) q = q.in("city", myCities);
  const { data } = await q;
  const rows = (data ?? []) as Request[];
  const ids = rows.map((r) => r.id);
  const [{ data: counts }, { data: mine }] = await Promise.all([
    ids.length ? supabase.rpc("request_reply_counts", { p_ids: ids }) : Promise.resolve({ data: [] }),
    user && profile?.role === "pro" && ids.length
      ? supabase.from("request_replies").select("request_id, price, note").eq("pro_id", user.id).in("request_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const replies = new Map(((counts ?? []) as { request_id: string; replies: number }[]).map((c) => [c.request_id, Number(c.replies)]));
  const myOffers = new Map(((mine ?? []) as { request_id: string; price: number | null; note: string | null }[]).map((r) => [r.request_id, r]));
  const role = profile?.role ?? null;
  const [late, { data: owners }] = role === "pro"
    ? await Promise.all([
        lateCancels(supabase, rows.map((r) => r.client_id)),
        rows.length ? supabase.from("profiles").select("id, name").in("id", [...new Set(rows.map((r) => r.client_id))]) : Promise.resolve({ data: [] }),
      ])
    : [new Map<string, number>(), { data: [] }];
  const ownerName = new Map(((owners ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name.split(" ")[0] || o.name]));

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Requests<em>.</em></h1>
          <p className="lede" style={{ margin: 0 }}>
            {role === "pro" ? "Car owners looking for a shoot. Send an offer; they compare and choose." : "Post your date. Creators send offers, you choose who shoots it."}
          </p>
        </div>
        {role !== "pro" && (
          <Link className="btn solid" data-tour="post-request" href={user ? "/requests/new" : "/signup?role=client&next=/requests/new"}>Post a request</Link>
        )}
      </div>
      {posted && <p className="notice" style={{ marginTop: 16 }}>Your request is up. You&apos;ll get a message when a creator replies.</p>}
      <div style={{ margin: "20px 0" }}>
        <Suspense><CityFilter value={showMine ? "mine" : city ?? "all"} noun="requests" mine={myCities} /></Suspense>
      </div>
      {rows.length === 0 && (
        <p className="notice">
          No open requests{city ? ` in ${cityLabel(city)}` : showMine ? " in your cities" : ""} right now.{role !== "pro" ? " Be the first to post one." : ""}
          {(city || showMine) && role === "pro" ? <> <Link href="/requests?city=all">See all cities</Link>.</> : null}
        </p>
      )}
      <div className="grid">
        {rows.map((r) => {
          const n = replies.get(r.id) ?? 0;
          const own = !!user && r.client_id === user.id;
          return (
            <article key={r.id} className="card req">
              <div className="req-top">
                <DateTile day={r.date_from} />
                <div style={{ minWidth: 0 }}>
                  <span className="eyebrow">{r.shoot_type} · {KIND[r.kind]}</span>
                  {r.free && <span className="badge free">Free portfolio shoot</span>}
                  <h3>{r.car}</h3>
                  <span className="small muted">
                    {r.city}
                    {r.date_from !== r.date_to ? ` · until ${short(r.date_to)}` : ""}
                    {!r.free && r.budget ? ` · $${r.budget} budget` : ""}
                  </span>
                </div>
              </div>
              {ownerName.has(r.client_id) && (
                <p className="small muted req-late">
                  Posted by <Link className="who-link" href={`/u/${r.client_id}`}>{ownerName.get(r.client_id)}</Link>
                  {late.get(r.client_id) ? <span className="late"> · {lateLabel(late.get(r.client_id))}</span> : null}
                </p>
              )}
              {!ownerName.has(r.client_id) && late.get(r.client_id) ? <p className="small late req-late">Owner: {lateLabel(late.get(r.client_id))}</p> : null}
              {r.note && <p className="small req-note">{r.note}</p>}
              <div className="req-foot">
                <span className="small muted">{own ? "Yours · " : ""}{n} {n === 1 ? "offer" : "offers"} · {ago(r.created_at)}</span>
                <RequestActions id={r.id} role={role} signedIn={!!user} own={own} offers={n} mine={myOffers.get(r.id) ?? null} budget={r.budget} free={!!r.free} />
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

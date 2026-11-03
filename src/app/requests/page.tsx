import Link from "next/link";
import { getMe } from "@/lib/supabase/server";
import { CITIES } from "@/lib/types";
import { goldenHour, today } from "@/lib/sun";
import RequestActions from "./RequestActions";

export type Request = {
  id: string; client_id: string; car: string; city: string; kind: "photo" | "video" | "either"; shoot_type: string;
  date_from: string; date_to: string; budget: number | null; note: string | null; status: "open" | "closed"; created_at: string;
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
  const { city, posted } = await searchParams;
  const { supabase, user, profile } = await getMe();
  let q = supabase.from("requests").select("*").eq("status", "open").gte("date_to", today()).order("created_at", { ascending: false }).limit(60);
  if (city && (CITIES as readonly string[]).includes(city)) q = q.eq("city", city);
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

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Requests<em>.</em></h1>
          <p className="lede" style={{ margin: 0 }}>
            {role === "pro" ? "Car owners looking for a shoot. Send an offer; they compare and choose." : "Post your date. Photographers send offers, you choose who shoots it."}
          </p>
        </div>
        {role !== "pro" && (
          <Link className="btn pink" href={user ? "/requests/new" : "/signup?role=client&next=/requests/new"}>Post a request</Link>
        )}
      </div>
      {posted && <p className="notice" style={{ marginTop: 16 }}>Your request is up. You&apos;ll get a message when a photographer replies.</p>}
      <div className="chips" style={{ margin: "20px 0" }}>
        <Link className="chip" aria-pressed={!city} href="/requests">All cities</Link>
        {CITIES.map((c) => (
          <Link key={c} className="chip" aria-pressed={city === c} href={`/requests?city=${encodeURIComponent(c)}`}>{c}</Link>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="notice">No open requests{city ? ` in ${city}` : ""} right now.{role !== "pro" && " Be the first to post one."}</p>
      )}
      <div className="grid">
        {rows.map((r) => {
          const n = replies.get(r.id) ?? 0;
          const own = !!user && r.client_id === user.id;
          return (
            <article key={r.id} className="card req">
              <span className="eyebrow">{r.shoot_type} · {KIND[r.kind]}</span>
              <h3>{r.car}</h3>
              <div className="req-meta">
                <span>{r.city}</span>
                <span>{r.date_from === r.date_to ? short(r.date_from) : `${short(r.date_from)} – ${short(r.date_to)}`}</span>
                {r.budget && <span>${r.budget} budget</span>}
                <span>Golden hour {goldenHour(r.date_from)}</span>
              </div>
              {r.note && <p className="small" style={{ margin: "10px 0 0" }}>{r.note}</p>}
              <div className="req-foot">
                <span className="small muted">{own ? "Yours · " : ""}{n} {n === 1 ? "offer" : "offers"} · {ago(r.created_at)}</span>
                <RequestActions id={r.id} role={role} signedIn={!!user} own={own} offers={n} mine={myOffers.get(r.id) ?? null} budget={r.budget} />
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

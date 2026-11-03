import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { KIND_LABEL, photoUrl, type Kind } from "@/lib/types";
import { goldenHour, prettyDate } from "@/lib/sun";
import type { Request } from "../page";
import OfferChoice from "./OfferChoice";
import { lateCancels, lateLabel } from "@/lib/lateCancels";

type Offer = {
  pro_id: string; price: number; note: string | null; status: "waiting" | "chosen" | "passed"; created_at: string;
  pro: { city: string; kind: Kind; photos: string[]; shoot_types: string[]; profiles: { name: string } | null } | null;
};

export default async function RequestOffers({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getMe();
  if (!user) redirect(`/signup?next=/requests/${id}`);
  const { data } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Request;
  if (r.client_id !== user.id) redirect("/requests");
  const { data: rows } = await supabase
    .from("request_replies")
    .select("pro_id, price, note, status, created_at, pro:pros(city, kind, photos, shoot_types, profiles(name))")
    .eq("request_id", id)
    .order("price");
  const offers = (rows ?? []) as unknown as Offer[];
  const late = await lateCancels(supabase, offers.map((o) => o.pro_id));
  const open = r.status === "open";
  const chosen = offers.find((o) => o.status === "chosen");

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <p className="eyebrow"><Link href="/requests">Requests</Link> · {r.city}</p>
      <h1 style={{ marginBottom: 6 }}>{r.shoot_type}<em>.</em></h1>
      <p className="lede" style={{ marginBottom: 10 }}>
        {r.car} · {prettyDate(r.date_from)} · golden hour {goldenHour(r.date_from)}{r.budget ? ` · $${r.budget} budget` : ""}
      </p>
      {r.note && <p className="muted" style={{ marginTop: 0 }}>{r.note}</p>}

      {chosen ? (
        <p className="notice">You chose <b>{chosen.pro?.profiles?.name}</b> for ${chosen.price}. It&apos;s booked and confirmed. <Link href="/shoots">See your shoots</Link></p>
      ) : !open ? (
        <p className="notice">This request is closed.</p>
      ) : offers.length === 0 ? (
        <p className="notice">No offers yet. Photographers in {r.city} can see your request. Their offers show up here.</p>
      ) : (
        <p className="small muted">{offers.length} offer{offers.length === 1 ? "" : "s"}, cheapest first. Look at their work, ask questions, then choose one. Choosing books it right away.</p>
      )}

      <div className="offers" style={{ marginTop: 16 }}>
        {offers.map((o) => {
          const name = o.pro?.profiles?.name ?? "Photographer";
          return (
            <article key={o.pro_id} className={`card offer-row ${o.status === "chosen" ? "chosen" : ""}`}>
              {o.pro?.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(o.pro.photos[0])} alt="" />
              ) : (
                <div className="ph" />
              )}
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div className="line">
                  <h3>{name}</h3>
                  <span className="price">${o.price}</span>
                </div>
                <span className="small muted">{KIND_LABEL[(o.pro?.kind ?? "photo") as Kind]} · {o.pro?.city}{late.get(o.pro_id) ? <span className="late"> · {lateLabel(late.get(o.pro_id))}</span> : null}</span>
                {o.note && <p className="small" style={{ margin: "4px 0 0" }}>{o.note}</p>}
              </div>
              <div className="offer-actions">
                <Link className="btn small" href={`/p/${o.pro_id}`}>Portfolio</Link>
                {o.status === "chosen" ? (
                  <span className="badge confirmed">Chosen</span>
                ) : (
                  open && <OfferChoice requestId={r.id} proId={o.pro_id} name={name} price={o.price} date={prettyDate(r.date_from)} />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

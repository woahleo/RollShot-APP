import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/supabase/server";
import { KIND_LABEL, photoUrl, type Kind, type ShootPost } from "@/lib/types";
import { prettyDate } from "@/lib/sun";
import { videoHost } from "@/lib/photos";
import OwnerControls from "./OwnerControls";

type Row = ShootPost & {
  pro: { city: string; kind: Kind; profiles: { name: string } | null } | null;
  car_row: { id: string; public: boolean } | null;
};

async function load(id: string) {
  const { supabase, user } = await getMe();
  const { data } = await supabase
    .from("shoot_posts")
    .select("*, pro:pros(city, kind, profiles(name)), car_row:cars(id, public)")
    .eq("id", id)
    .maybeSingle();
  return { supabase, user, s: data as Row | null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { s } = await load(id);
  if (!s || s.hidden_by_owner) return { title: "Shoot · Rollshot" };
  const title = `${s.car} · ${s.shoot_type} · Rollshot`;
  const description = s.caption ?? `${s.shoot_type} in ${s.city}, shot by ${s.pro?.profiles?.name ?? "a Rollshot photographer"}.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function Shot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, s } = await load(id);
  if (!s) notFound();
  const mine = user?.id === s.pro_id;
  const isOwner = user?.id === s.owner_id;
  if (s.hidden_by_owner && !mine && !isOwner) notFound();
  const name = s.pro?.profiles?.name ?? "Photographer";

  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <p className="eyebrow">{s.shoot_type} · {s.city} · {prettyDate(s.shoot_date)}</p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 style={{ marginBottom: 0 }}>{s.car}</h1>
        <Link className="btn solid" href={`/p/${s.pro_id}#book`}>Book {name.split(" ")[0]}</Link>
      </div>
      <p className="lede" style={{ margin: "12px 0 20px" }}>
        {s.shoot_type} by <Link href={`/p/${s.pro_id}`}>{name}</Link>
        {s.pro ? ` · ${KIND_LABEL[(s.pro.kind ?? "photo") as Kind]}` : ""} · ${s.price}
      </p>
      {s.caption && <p style={{ marginTop: 0 }}>{s.caption}</p>}
      {s.hidden_by_owner && <p className="notice">Hidden by the car&apos;s owner. Only you two can see this page.</p>}

      {s.photos.length > 0 && (
        <div className="gallery feature" style={{ marginTop: 16 }}>
          {s.photos.map((ph) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={ph} src={photoUrl(ph)} alt={`${s.car}, ${s.shoot_type}`} loading="lazy" />
          ))}
        </div>
      )}
      {s.video_url && (
        <p style={{ marginTop: 20 }}>
          <a className="btn" href={s.video_url} target="_blank" rel="noreferrer">Watch the video on {videoHost(s.video_url)}</a>
        </p>
      )}

      <div className="row" style={{ marginTop: 28, gap: 10 }}>
        {s.car_id && (s.car_row?.public || isOwner) && <Link className="btn small" href={`/car/${s.car_id}`}>More of this car</Link>}
        <Link className="btn small" href={`/p/${s.pro_id}`}>{name}&apos;s work</Link>
      </div>
      <OwnerControls id={s.id} isPro={mine} isOwner={isOwner} hidden={s.hidden_by_owner} />
    </main>
  );
}

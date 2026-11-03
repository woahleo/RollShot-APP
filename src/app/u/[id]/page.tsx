import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/supabase/server";
import { carLabel, photoUrl, type Car, type Profile } from "@/lib/types";
import { lateCancels, lateLabel } from "@/lib/lateCancels";
import Avatar from "@/components/Avatar";
import PhotoGallery from "@/components/PhotoGallery";
import ShotCard, { type ShotRow } from "@/components/ShotCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Car owner · Rollshot", robots: { index: false } };

/**
 * A car owner's profile: their picture, name and garage, with their own photos of each car and the
 * shoots creators posted of it. Only creators (and the owner themselves) can open it, from the owner's
 * name on a booking, a chat or a request. Cars the owner set to private stay off it.
 */
export default async function OwnerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user, profile } = await getMe();
  if (!user) redirect(`/signup?next=/u/${id}`);
  const mine = user.id === id;
  if (!mine && profile?.role !== "pro") notFound();

  const { data: who } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const owner = who as Profile | null;
  if (!owner) notFound();
  if (owner.role === "pro") redirect(`/p/${id}`);

  const [{ data: carRows }, { data: shotRows }, { data: thread }, late] = await Promise.all([
    supabase.from("cars").select("*").eq("owner_id", id).order("created_at"),
    supabase
      .from("shoot_posts")
      .select("*, pro:pros(profiles(name))")
      .eq("owner_id", id)
      .eq("hidden_by_owner", false)
      .order("shoot_date", { ascending: false }),
    mine ? Promise.resolve({ data: null }) : supabase.from("threads").select("id").eq("pro_id", user.id).eq("client_id", id).maybeSingle(),
    mine ? Promise.resolve(new Map<string, number>()) : lateCancels(supabase, [id]),
  ]);
  // The cars policy already hides private cars from everyone but the owner.
  const cars = ((carRows ?? []) as Car[]).filter((c) => mine || c.public !== false);
  const shots = (shotRows ?? []) as unknown as ShotRow[];
  const carIds = new Set(cars.map((c) => c.id));
  const loose = shots.filter((s) => !s.car_id);
  const shown = shots.filter((s) => !s.car_id || carIds.has(s.car_id)).length;
  const first = owner.name.split(" ")[0] || owner.name;
  const since = new Date(owner.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const lateText = lateLabel(late.get(id));

  return (
    <main className="wrap owner-page">
      <div className="pro-head">
        <Avatar name={owner.name} avatar={owner.avatar} size={88} />
        <div style={{ minWidth: 0 }}>
          <h1>{owner.name}</h1>
          <span className="small muted">
            Car owner · on Rollshot since {since}
            {cars.length ? ` · ${cars.length} car${cars.length === 1 ? "" : "s"}` : ""}
            {shown ? ` · ${shown} shoot${shown === 1 ? "" : "s"}` : ""}
          </span>
          {lateText && <span className="small late" style={{ display: "block" }}>{lateText}</span>}
        </div>
      </div>
      <div className="row" style={{ margin: "16px 0 8px", gap: 8 }}>
        {mine ? (
          <>
            <Link className="btn small" href="/me">Edit your garage</Link>
            <span className="small muted">This is what creators see.</span>
          </>
        ) : thread ? (
          <Link className="btn small solid" href={`/messages/${(thread as { id: string }).id}`}>Message {first}</Link>
        ) : null}
      </div>

      {cars.length === 0 && loose.length === 0 && (
        <p className="notice" style={{ marginTop: 20 }}>
          {mine ? <>No cars yet. <Link href="/me">Add your car</Link> and a few photos of it.</> : `${first} hasn't added a car yet.`}
        </p>
      )}

      {cars.map((c) => {
        const own = c.photos ?? [];
        const posts = shots.filter((s) => s.car_id === c.id);
        const label = carLabel(c) || "Car";
        return (
          <section key={c.id} className="owner-car">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0 }}>{label}<em>.</em></h2>
              {c.public !== false ? <Link className="small" href={`/car/${c.id}`}>Car page</Link> : <span className="small muted">Private, only you see it</span>}
            </div>
            {c.mods && <p className="muted" style={{ margin: "4px 0 0" }}>{c.mods}</p>}
            {own.length > 0 && (
              <>
                <p className="eyebrow owner-sub">{mine ? "Your photos" : `${first}'s photos`}</p>
                <PhotoGallery photos={own.map(photoUrl)} alt={label} />
              </>
            )}
            {posts.length > 0 && (
              <>
                <p className="eyebrow owner-sub">Shot by creators on Rollshot</p>
                <div className="grid pros">{posts.map((s) => <ShotCard key={s.id} s={s} />)}</div>
              </>
            )}
            {own.length === 0 && posts.length === 0 && (
              <p className="small muted" style={{ marginTop: 12 }}>
                {mine ? <>No photos yet. <Link href="/me">Add some from your garage</Link>.</> : "No photos of this car yet."}
              </p>
            )}
          </section>
        );
      })}

      {loose.length > 0 && (
        <section className="owner-car">
          <h2 style={{ margin: 0 }}>{cars.length ? "More shoots" : "Shoots"}<em>.</em></h2>
          <div className="grid pros" style={{ marginTop: 16 }}>{loose.map((s) => <ShotCard key={s.id} s={s} />)}</div>
        </section>
      )}
    </main>
  );
}

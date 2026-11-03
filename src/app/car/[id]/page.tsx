import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/supabase/server";
import { carLabel, type Car } from "@/lib/types";
import ShotCard, { type ShotRow } from "@/components/ShotCard";

async function load(id: string) {
  const { supabase, user } = await getMe();
  const { data } = await supabase.from("cars").select("*, public").eq("id", id).maybeSingle();
  const car = data as (Car & { public: boolean }) | null;
  if (!car) return { user, car: null, shots: [] as ShotRow[] };
  const { data: rows } = await supabase
    .from("shoot_posts")
    .select("*, pro:pros(profiles(name))")
    .eq("car_id", id)
    .eq("hidden_by_owner", false)
    .order("shoot_date", { ascending: false });
  return { user, car, shots: (rows ?? []) as unknown as ShotRow[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { car } = await load(id);
  return car ? { title: `${carLabel(car)} · Rollshot` } : { title: "Car" };
}

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, car, shots } = await load(id);
  if (!car) notFound();
  const mine = user?.id === car.owner_id;
  if (!car.public && !mine) notFound();

  return (
    <main className="wrap">
      <p className="eyebrow">{shots.length} shoot{shots.length === 1 ? "" : "s"} on Rollshot</p>
      <h1>{carLabel(car)}<em>.</em></h1>
      {car.mods && <p className="lede">{car.mods}</p>}
      {mine && !car.public && <p className="notice">This page is off. Turn it on in your <Link href="/me">garage</Link> to share it.</p>}

      {shots.length === 0 ? (
        <p className="notice">
          No shoots yet.{" "}
          {mine ? <>Once a photographer posts the photos from a shoot, they show up here. <Link href="/book">Book one</Link>.</> : "Check back after its next shoot."}
        </p>
      ) : (
        <div className="grid pros" style={{ marginTop: 20 }}>
          {shots.map((s) => <ShotCard key={s.id} s={s} />)}
        </div>
      )}
      {mine && <p className="small muted" style={{ marginTop: 28 }}>Anyone with this link can see this page. Your name isn&apos;t on it.</p>}
    </main>
  );
}

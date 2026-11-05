import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { MIN_PHOTOS, proPath } from "@/lib/types";
import { cityLabel, isCity } from "@/lib/cities";
import CityFilter from "@/components/CityFilter";
import ProCard, { type ProRow } from "@/components/ProCard";

const KINDS: { key: string; label: string }[] = [
  { key: "", label: "Everyone" },
  { key: "photo", label: "Photo" },
  { key: "video", label: "Video" },
];

export default async function Book({ searchParams }: { searchParams: Promise<{ city?: string; kind?: string }> }) {
  const { city: picked, kind } = await searchParams;
  const city = isCity(picked) ? picked : undefined;
  const supabase = await createClient();
  let q = supabase.from("pros").select("*, profiles(name), packages(*)").gte("photo_count", MIN_PHOTOS).order("updated_at", { ascending: false });
  if (city) q = q.contains("all_cities", [city]);
  if (kind === "photo" || kind === "video") q = q.in("kind", [kind, "both"]);
  const [{ data }, { data: cc }] = await Promise.all([q, supabase.rpc("city_counts")]);
  const counts = Object.fromEntries(((cc ?? []) as { city: string; creators: number }[]).map((r) => [r.city, Number(r.creators)]));
  const pros = (data ?? []) as ProRow[];
  const href = (c?: string, k?: string) => {
    const p = new URLSearchParams();
    if (c) p.set("city", c);
    if (k) p.set("kind", k);
    const s = p.toString();
    return s ? `/book?${s}` : "/book";
  };

  return (
    <main className="wrap">
      <h1>Find a creator<em>.</em></h1>
      <p className="lede">Pick someone whose work you like and book an open day. Or <Link href="/requests">post a request</Link> and let them come to you.</p>
      <div className="filters" data-tour="filters">
        <div className="seg" role="group" aria-label="Who">
          {KINDS.map((k) => (
            <Link key={k.key} aria-pressed={(kind ?? "") === k.key} href={href(city, k.key)}>{k.label}</Link>
          ))}
        </div>
        <Suspense><CityFilter value={city ?? "all"} counts={counts} /></Suspense>
      </div>
      {pros.length === 0 && (
        <div className="notice first-city">
          {city ? (
            <>
              <b>No creators in {cityLabel(city)} yet.</b>
              <span>Shoot cars there? <Link href="/signup?role=pro">Be the first creator in {city}</Link>. Car owners can still <Link href="/requests/new">post a request</Link>, and creators who join will see it.</span>
            </>
          ) : (
            <span>No one matches yet. Check back soon, or <Link href="/signup?role=pro">join as a creator</Link>.</span>
          )}
        </div>
      )}
      <div className="grid pros" data-tour="creators">
        {pros.map((p) => <ProCard key={p.id} p={p} href={`${proPath(p)}#book`} />)}
      </div>
    </main>
  );
}

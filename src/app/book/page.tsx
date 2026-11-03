import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CITIES, proPath } from "@/lib/types";
import ProCard, { type ProRow } from "@/components/ProCard";

const KINDS: { key: string; label: string }[] = [
  { key: "", label: "Everyone" },
  { key: "photo", label: "Photo" },
  { key: "video", label: "Video" },
];

export default async function Book({ searchParams }: { searchParams: Promise<{ city?: string; kind?: string }> }) {
  const { city, kind } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("pros").select("*, profiles(name), packages(*)").order("updated_at", { ascending: false });
  if (city && (CITIES as readonly string[]).includes(city)) q = q.eq("city", city);
  if (kind === "photo" || kind === "video") q = q.in("kind", [kind, "both"]);
  const { data } = await q;
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
      <div className="filters">
        <div className="seg" role="group" aria-label="Who">
          {KINDS.map((k) => (
            <Link key={k.key} aria-pressed={(kind ?? "") === k.key} href={href(city, k.key)}>{k.label}</Link>
          ))}
        </div>
        <div className="chips scroll" role="group" aria-label="City">
          <Link className="chip" aria-pressed={!city} href={href(undefined, kind)}>All cities</Link>
          {CITIES.map((c) => (
            <Link key={c} className="chip" aria-pressed={city === c} href={href(c, kind)}>{c}</Link>
          ))}
        </div>
      </div>
      {pros.length === 0 && (
        <p className="notice">No one matches yet. Check back soon, or <Link href="/signup?role=pro">join as a creator</Link>.</p>
      )}
      <div className="grid pros">
        {pros.map((p) => <ProCard key={p.id} p={p} href={`${proPath(p)}#book`} />)}
      </div>
    </main>
  );
}

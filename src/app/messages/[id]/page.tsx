import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { carLabel, type Car, type Message, type Package, type Thread } from "@/lib/types";
import { today } from "@/lib/sun";
import Chat from "./Chat";

export default async function ChatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ offer?: string }> }) {
  const { id } = await params;
  const { offer } = await searchParams;
  const { supabase, user } = await getMe();
  if (!user) redirect("/signup");
  const { data } = await supabase
    .from("threads")
    .select("*, pro:pros(profiles(name)), client:profiles!threads_client_id_fkey(name, role)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as Thread & { pro: { profiles: { name: string } | null } | null; client: { name: string; role: string } | null };
  // Two creators talking about a crew job: no booking tools or message limit, and it unlocks once one hires the other.
  const crew = t.client?.role === "pro";
  const isPro = t.pro_id === user.id && !crew;
  const [{ data: messages }, { data: bookings }, { data: packages }, { data: pro }, { data: cars }] = await Promise.all([
    supabase.from("messages").select("*").eq("thread_id", id).order("created_at"),
    supabase.from("bookings").select("status").eq("pro_id", t.pro_id).eq("client_id", t.client_id),
    isPro ? supabase.from("packages").select("*").eq("pro_id", user.id).order("position") : Promise.resolve({ data: [] }),
    isPro ? supabase.from("pros").select("open_dates").eq("id", user.id).single() : Promise.resolve({ data: null }),
    isPro ? Promise.resolve({ data: [] }) : supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at"),
  ]);
  const statuses = (bookings ?? []).map((b) => b.status as string);
  const { data: hired } = crew
    ? await supabase.rpc("has_confirmed_booking", { p_pro: t.pro_id, p_client: t.client_id })
    : { data: false };
  const confirmed = statuses.some((s) => s === "confirmed" || s === "rescheduled") || hired === true;
  const requested = crew || statuses.some((s) => s !== "declined" && s !== "cancelled");
  const other = t.pro_id === user.id ? t.client?.name : t.pro?.profiles?.name;

  return (
    <main className="wrap" style={{ paddingBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{other ?? "Chat"}</h2>
        {crew ? (
          <Link className="btn small" href="/crew">Crew jobs</Link>
        ) : !isPro && <Link className="btn small" href={`/p/${t.pro_id}`}>{requested ? "View profile" : "Book a date"}</Link>}
      </div>
      <Chat
        threadId={id}
        userId={user.id}
        isPro={isPro}
        initial={(messages ?? []) as Message[]}
        confirmed={confirmed}
        requested={requested}
        unlimited={t.unlimited}
        startOffer={isPro && offer === "1"}
        otherName={other ?? ""}
        packages={(packages ?? []) as Package[]}
        openDates={((pro as { open_dates: string[] } | null)?.open_dates ?? []).filter((d) => d >= today()).sort()}
        cars={((cars ?? []) as Car[]).map(carLabel).filter(Boolean)}
      />
    </main>
  );
}

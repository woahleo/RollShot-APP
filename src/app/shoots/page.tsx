import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";
import BookingRow from "@/components/BookingRow";
import { lateCancels } from "@/lib/lateCancels";
import { today } from "@/lib/sun";

type Row = Booking & { pro: { open_dates: string[]; profiles: { name: string } | null } | null };

export default async function Shoots({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?next=/shoots");
  if (!profile) redirect("/onboarding");
  if (profile.role === "pro") redirect("/pro");
  const sp = await searchParams;
  const { data } = await supabase
    .from("bookings")
    .select("*, pro:pros(open_dates, profiles(name))")
    .eq("client_id", user.id)
    .order("shoot_date");
  const rows = (data ?? []) as Row[];
  const late = await lateCancels(supabase, rows.map((b) => b.pro_id));
  const now = today();
  const upcoming = rows.filter((b) => b.shoot_date >= now && b.status !== "declined" && b.status !== "cancelled");
  const past = rows.filter((b) => !upcoming.includes(b)).reverse();
  const row = (b: Row) => (
    <BookingRow key={b.id} b={b} who={b.pro?.profiles?.name ?? "Photographer"} asPro={false} openDates={b.pro?.open_dates ?? []} whoLate={late.get(b.pro_id)} />
  );

  return (
    <main className="wrap">
      <h1>Shoots<em>.</em></h1>
      {sp.requested && <p className="notice">Request sent. You&apos;ll see it here when they answer, and chat is open with them now.</p>}
      <h2>Coming up</h2>
      {upcoming.length === 0 ? (
        <p className="muted">
          Nothing booked. <Link href="/book">Find a photographer</Link> or <Link href="/requests/new">post a request</Link>.
        </p>
      ) : (
        <div className="list" style={{ display: "grid" }}>{upcoming.map(row)}</div>
      )}
      {past.length > 0 && (
        <>
          <h2>Past and cancelled</h2>
          <div className="list" style={{ display: "grid" }}>{past.map(row)}</div>
        </>
      )}
    </main>
  );
}

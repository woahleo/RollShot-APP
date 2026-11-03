import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking, Pro } from "@/lib/types";
import { today } from "@/lib/sun";
import BookingRow from "@/components/BookingRow";
import OpenDates from "./OpenDates";

type Row = Booking & { client: { name: string } | null };

export default async function Dashboard() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  if (profile.role !== "pro") redirect("/me");
  const [{ data: pro }, { data: bookings }] = await Promise.all([
    supabase.from("pros").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*, client:profiles!bookings_client_id_fkey(name)").eq("pro_id", user.id).order("shoot_date"),
  ]);
  const p = pro as Pro;
  const rows = (bookings ?? []) as Row[];
  const now = today();
  const requests = rows.filter((b) => b.status === "requested" && b.shoot_date >= now);
  const upcoming = rows.filter((b) => (b.status === "confirmed" || b.status === "rescheduled") && b.shoot_date >= now);
  const earned = rows.filter((b) => b.status !== "declined" && b.status !== "requested").reduce((s, b) => s + b.price, 0);

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Hey {profile.name.split(" ")[0]}.</h1>
        <div className="row">
          <Link className="btn small" href={`/p/${user.id}`}>View my page</Link>
          <Link className="btn solid small" href="/pro/edit">Edit profile</Link>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="card"><span className="eyebrow">New requests</span><h2 style={{ margin: 0 }}>{requests.length}</h2></div>
        <div className="card"><span className="eyebrow">Upcoming</span><h2 style={{ margin: 0 }}>{upcoming.length}</h2></div>
        <div className="card"><span className="eyebrow">Booked total</span><h2 style={{ margin: 0 }}>${earned}</h2></div>
      </div>
      {p.photos.length === 0 && (
        <p className="notice" style={{ marginTop: 16 }}>Clients book what they can see. <Link href="/pro/edit">Add portfolio photos and packages</Link> to show up properly.</p>
      )}
      <h2>Requests</h2>
      {requests.length === 0 && <p className="muted">Nothing waiting. Open more dates below to get requests.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {requests.map((b) => <BookingRow key={b.id} b={b} who={b.client?.name ?? "Client"} asPro openDates={p.open_dates} />)}
      </div>
      <h2>Upcoming shoots</h2>
      {upcoming.length === 0 && <p className="muted">No confirmed shoots yet.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {upcoming.map((b) => <BookingRow key={b.id} b={b} who={b.client?.name ?? "Client"} asPro openDates={p.open_dates} />)}
      </div>
      <h2>Open dates</h2>
      <p className="small muted">Tap days you can shoot. Golden hour times show under each day.</p>
      <OpenDates userId={user.id} initial={p.open_dates} />
    </main>
  );
}

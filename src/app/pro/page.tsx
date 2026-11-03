import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking, Pro } from "@/lib/types";
import { prettyDate, today } from "@/lib/sun";
import BookingRow from "@/components/BookingRow";
import OpenDates from "./OpenDates";

type Row = Booking & { client: { name: string } | null };

export default async function Dashboard() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  if (profile.role !== "pro") redirect("/me");
  const [{ data: pro }, { data: bookings }, { count: packages }, { data: offerRows }] = await Promise.all([
    supabase.from("pros").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*, client:profiles!bookings_client_id_fkey(name)").eq("pro_id", user.id).order("shoot_date"),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("pro_id", user.id),
    supabase.from("request_replies").select("price, status, request:requests(car, shoot_type, city, date_from)").eq("pro_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  type MyOffer = { price: number; status: "waiting" | "chosen" | "passed"; request: { car: string; shoot_type: string; city: string; date_from: string } | null };
  const myOffers = ((offerRows ?? []) as unknown as MyOffer[]).filter((o) => o.request && o.request.date_from >= today());
  const p = pro as Pro;
  const rows = (bookings ?? []) as Row[];
  const now = today();
  const requests = rows.filter((b) => b.status === "requested" && b.shoot_date >= now);
  const upcoming = rows.filter((b) => (b.status === "confirmed" || b.status === "rescheduled") && b.shoot_date >= now);
  const noPackages = packages === 0;
  const noDates = !p.open_dates.some((d) => d >= now);
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
      {noPackages || noDates ? (
        <p className="notice" style={{ marginTop: 16 }}>
          <b>Car owners can&apos;t book you yet.</b> Add{" "}
          {noPackages && <Link href="/pro/edit">a package with a price</Link>}
          {noPackages && noDates && " and "}
          {noDates && <a href="#dates">open dates</a>} so they can pick a day and press Book now.
        </p>
      ) : p.photos.length === 0 ? (
        <p className="notice" style={{ marginTop: 16 }}>Clients book what they can see. <Link href="/pro/edit">Add portfolio photos</Link> to show up properly.</p>
      ) : null}
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
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Your offers</h2>
        <Link className="small" href="/requests">Find requests</Link>
      </div>
      {myOffers.length === 0 && <p className="muted">No offers out. Car owners post dates on the <Link href="/requests">request board</Link>.</p>}
      <div className="list">
        {myOffers.map((o, i) => (
          <div key={i} className="card" style={{ padding: "12px 16px" }}>
            <span>{o.request!.shoot_type} · {o.request!.car} · {o.request!.city} · {prettyDate(o.request!.date_from)}</span>
            <span className="row" style={{ gap: 8 }}>
              <b style={{ fontWeight: 400 }}>${o.price}</b>
              <span className={`badge ${o.status === "chosen" ? "confirmed" : o.status === "passed" ? "declined" : "requested"}`}>
                {o.status === "chosen" ? "Chosen" : o.status === "passed" ? "Not chosen" : "Waiting"}
              </span>
            </span>
          </div>
        ))}
      </div>
      <h2 id="dates">Open dates</h2>
      <p className="small muted">Tap the days you can shoot. Tap again to close a day. Clients only see these days.</p>
      <OpenDates userId={user.id} initial={p.open_dates} />
    </main>
  );
}

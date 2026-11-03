import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking, Car } from "@/lib/types";
import BookingRow from "@/components/BookingRow";
import { prettyDate, today } from "@/lib/sun";
import Garage from "./Garage";

type Row = Booking & { pro: { open_dates: string[]; profiles: { name: string } | null } | null };

export default async function Me({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  if (profile.role === "pro") redirect("/pro");
  const sp = await searchParams;
  const [{ data: bookings }, { data: cars }, { data: requests }] = await Promise.all([
    supabase.from("bookings").select("*, pro:pros(open_dates, profiles(name))").eq("client_id", user.id).order("shoot_date"),
    supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("requests").select("id, car, shoot_type, city, date_from, status, request_replies(count)").eq("client_id", user.id).eq("status", "open").gte("date_from", today()).order("date_from"),
  ]);
  const myRequests = (requests ?? []) as { id: string; car: string; shoot_type: string; city: string; date_from: string; request_replies: { count: number }[] }[];
  const rows = (bookings ?? []) as Row[];

  return (
    <main className="wrap">
      <h1>Hey {profile.name.split(" ")[0]}.</h1>
      {sp.requested && <p className="notice">Request sent. You&apos;ll see it here when they answer, and chat is open with them now.</p>}
      <h2>My garage</h2>
      <Garage userId={user.id} cars={(cars ?? []) as Car[]} />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Requests</h2>
        <Link className="small" href="/requests/new">Post a request</Link>
      </div>
      {myRequests.length === 0 ? (
        <p className="muted">No open requests. Post a date and photographers send you offers to choose from.</p>
      ) : (
        <div className="list">
          {myRequests.map((r) => {
            const n = r.request_replies[0]?.count ?? 0;
            return (
              <div key={r.id} className="card" style={{ padding: "12px 16px" }}>
                <span>{r.shoot_type} · {r.car} · {prettyDate(r.date_from)}</span>
                <Link className={`btn small ${n ? "solid" : ""}`} href={`/requests/${r.id}`}>{n ? `See ${n} offer${n === 1 ? "" : "s"}` : "No offers yet"}</Link>
              </div>
            );
          })}
        </div>
      )}
      <h2>Shoots</h2>
      {rows.length === 0 && <p className="muted">No shoots yet. <a href="/book">Find a photographer</a>.</p>}
      <div className="list" style={{ display: "grid" }}>
        {rows.map((b) => (
          <BookingRow key={b.id} b={b} who={b.pro?.profiles?.name ?? "Photographer"} asPro={false} openDates={b.pro?.open_dates ?? []} />
        ))}
      </div>
    </main>
  );
}

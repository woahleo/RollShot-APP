import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking, Car } from "@/lib/types";
import BookingRow from "@/components/BookingRow";
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
    supabase.from("requests").select("id, car, shoot_type, city, date_to, status, request_replies(count)").eq("client_id", user.id).eq("status", "open").order("created_at", { ascending: false }),
  ]);
  const myRequests = (requests ?? []) as { id: string; car: string; shoot_type: string; city: string; date_to: string; request_replies: { count: number }[] }[];
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
        <p className="muted">No open requests. Post one and photographers reply with dates and a price.</p>
      ) : (
        <div className="list">
          {myRequests.map((r) => {
            const n = r.request_replies[0]?.count ?? 0;
            return (
              <div key={r.id} className="card" style={{ padding: "12px 16px" }}>
                <span>{r.shoot_type} · {r.car} · {r.city}</span>
                <span className="small muted">{n} {n === 1 ? "reply" : "replies"}{n > 0 && <> · <Link href="/messages">see messages</Link></>}</span>
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

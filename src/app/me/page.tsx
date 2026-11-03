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
  const [{ data: bookings }, { data: cars }] = await Promise.all([
    supabase.from("bookings").select("*, pro:pros(open_dates, profiles(name))").eq("client_id", user.id).order("shoot_date"),
    supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at"),
  ]);
  const rows = (bookings ?? []) as Row[];

  return (
    <main className="wrap">
      <h1>Hey {profile.name.split(" ")[0]}.</h1>
      {sp.requested && <p className="notice">Request sent. You&apos;ll see it here when they answer, and chat is open with them now.</p>}
      <h2>Your shoots</h2>
      {rows.length === 0 && <p className="muted">No shoots yet. <a href="/book">Find a shooter</a>.</p>}
      <div className="list" style={{ display: "grid" }}>
        {rows.map((b) => (
          <BookingRow key={b.id} b={b} who={b.pro?.profiles?.name ?? "Shooter"} asPro={false} openDates={b.pro?.open_dates ?? []} />
        ))}
      </div>
      <h2>My garage</h2>
      <Garage userId={user.id} cars={(cars ?? []) as Car[]} />
    </main>
  );
}

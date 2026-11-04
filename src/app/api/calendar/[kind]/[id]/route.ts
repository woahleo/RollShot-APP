import type { NextRequest } from "next/server";
import { getMe } from "@/lib/supabase/server";
import { googleLink, icsFile, type CalEvent } from "@/lib/calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Person = { name: string | null } | null;
const first = (p: Person | undefined, fallback: string) => p?.name?.trim().split(/\s+/)[0] || fallback;

/**
 * Add a booked shoot or crew job to a calendar. /api/calendar/booking/<id> gives an .ics file
 * (Apple Calendar, Outlook); add ?to=google to open Google Calendar instead. Only the two people
 * on the shoot can get it, since the database only shows the row to them.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!UUID.test(id) || (kind !== "booking" && kind !== "gig")) return new Response("Not found", { status: 404 });
  const { supabase, user } = await getMe();
  if (!user) return Response.redirect(new URL(`/signup?next=${kind === "gig" ? "/crew" : "/shoots"}`, req.url), 302);
  const site = new URL(req.url).origin;
  let ev: CalEvent | null = null;

  if (kind === "booking") {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, pro_id, client_id, package_name, price, shoot_date, shoot_time, car, status, client:profiles!bookings_client_id_fkey(name), pro:pros(city, profiles(name))")
      .eq("id", id)
      .maybeSingle();
    if (b && (b.status === "confirmed" || b.status === "rescheduled")) {
      const asPro = b.pro_id === user.id;
      const pro = b.pro as unknown as { city: string | null; profiles: Person } | null;
      const client = b.client as unknown as Person;
      const { data: t } = await supabase.from("threads").select("id").eq("pro_id", b.pro_id).eq("client_id", b.client_id).maybeSingle();
      ev = {
        uid: `booking-${b.id}`,
        title: asPro ? `Rollshot: ${b.car ? `${b.car} for ` : "shoot for "}${first(client, "your client")}` : `Rollshot: car shoot with ${first(pro?.profiles, "your creator")}`,
        day: b.shoot_date,
        time: b.shoot_time,
        details: [`${b.package_name} · $${b.price}`, b.car ? `Car: ${b.car}` : "", b.shoot_time ? "" : "Time to be set in chat."].filter(Boolean).join("\n"),
        location: pro?.city ? `${pro.city}, FL` : undefined,
        url: t ? `${site}/messages/${t.id}` : `${site}${asPro ? "/pro" : "/shoots"}`,
      };
    }
  } else {
    const { data: g } = await supabase
      .from("gigs")
      .select("id, poster_id, hired_id, role, city, shoot_date, shoot_time, pay, note, status, poster:pros!gigs_poster_id_fkey(profiles(name)), hired:pros!gigs_hired_id_fkey(profiles(name))")
      .eq("id", id)
      .maybeSingle();
    if (g && g.status === "filled" && (g.poster_id === user.id || g.hired_id === user.id)) {
      const poster = (g.poster as unknown as { profiles: Person } | null)?.profiles;
      const hired = (g.hired as unknown as { profiles: Person } | null)?.profiles;
      const mine = g.poster_id === user.id;
      ev = {
        uid: `gig-${g.id}`,
        title: mine ? `Rollshot: ${first(hired, "crew")} as ${String(g.role).toLowerCase()}` : `Rollshot: ${String(g.role).toLowerCase()} for ${first(poster, "a creator")}`,
        day: g.shoot_date,
        time: g.shoot_time,
        minutes: 180,
        details: [`${g.role} · $${g.pay}`, g.note ?? "", g.shoot_time ? "" : "Time to be set in chat."].filter(Boolean).join("\n"),
        location: g.city,
        url: `${site}/crew`,
      };
    }
  }

  if (!ev) return new Response("This shoot isn't booked, or it isn't yours.", { status: 404 });
  if (req.nextUrl.searchParams.get("to") === "google") return Response.redirect(googleLink(ev), 302);
  return new Response(icsFile(ev), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="rollshot-${kind}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

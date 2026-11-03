import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { proPath, type Booking, type Pro } from "@/lib/types";
import PortfolioPhotos from "@/components/PortfolioPhotos";
import ReelPicker from "@/components/ReelPicker";
import { igReady } from "@/lib/instagram";
import { prettyDate, today } from "@/lib/sun";
import BookingRow from "@/components/BookingRow";
import { lateCancels } from "@/lib/lateCancels";
import OpenDates from "./OpenDates";
import ShotCard, { type ShotRow } from "@/components/ShotCard";

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
  const earned = rows.filter((b) => b.status === "confirmed" || b.status === "rescheduled").reduce((s, b) => s + b.price, 0);
  const late = await lateCancels(supabase, rows.map((b) => b.client_id));
  const { data: postRows } = await supabase.from("shoot_posts").select("*").eq("pro_id", user.id).order("shoot_date", { ascending: false });
  const posts = (postRows ?? []) as unknown as ShotRow[];
  const posted = new Set(posts.map((s) => s.booking_id));
  // Shoots that happened and still have no photos up.
  const toPost = rows.filter((b) => (b.status === "confirmed" || b.status === "rescheduled") && b.shoot_date <= now && !posted.has(b.id));

  return (
    <main className="wrap dash">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 style={{ marginBottom: 0 }}>Dashboard<em>.</em></h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn small" href={proPath({ id: user.id, handle: pro?.handle })}>View my page</Link>
          <Link className="btn solid small" href="/pro/edit">Edit profile</Link>
        </div>
      </div>
      <div className="stats">
        <div><b>{requests.length}</b><span>New requests</span></div>
        <div><b>{upcoming.length}</b><span>Upcoming</span></div>
        <div><b>${earned}</b><span>Booked total</span></div>
      </div>
      {noPackages || noDates ? (
        <p className="notice" style={{ marginTop: 16 }}>
          <b>Car owners can&apos;t book you yet.</b> Add{" "}
          {noPackages && <Link href="/pro/edit">a package with a price</Link>}
          {noPackages && noDates && " and "}
          {noDates && <a href="#dates">open days</a>} so they can pick a day and press Book now.
        </p>
      ) : null}

      <section>
        <h2>Bookings</h2>
        {requests.length === 0 && upcoming.length === 0 ? (
          <p className="muted">No requests or shoots yet. Open some days below and car owners can book you.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {requests.map((b) => <BookingRow key={b.id} b={b} who={b.client?.name ?? "Client"} asPro openDates={p.open_dates} whoLate={late.get(b.client_id)} />)}
            {upcoming.map((b) => <BookingRow key={b.id} b={b} who={b.client?.name ?? "Client"} asPro openDates={p.open_dates} whoLate={late.get(b.client_id)} />)}
          </div>
        )}
      </section>

      <section id="dates">
        <h2>Open days</h2>
        <OpenDates userId={user.id} initial={p.open_dates} initialHours={p.open_hours ?? {}} booked={upcoming.map((b) => b.shoot_date)} />
      </section>

      <section>
        <PortfolioPhotos userId={user.id} photos={p.photos} pageHref={proPath({ id: user.id, handle: p.handle })} instagram={igReady()} />
      </section>

      <section>
        <ReelPicker userId={user.id} reels={p.reels ?? []} pageHref={proPath({ id: user.id, handle: p.handle })} instagram={igReady()} />
      </section>

      {(toPost.length > 0 || posts.length > 0) && (
        <section>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2>Your shoots</h2>
            {posts.length > 0 && <Link className="small" href={proPath({ id: user.id, handle: pro?.handle })}>See your page</Link>}
          </div>
          {toPost.length > 0 && (
            <div className="notice" style={{ display: "grid", gap: 10 }}>
              <b style={{ fontWeight: 400 }}>{toPost.length} shoot{toPost.length === 1 ? "" : "s"} waiting on photos</b>
              <span className="muted">Posting puts your work on your page and in the feed, with a Book button on it.</span>
              <div className="row" style={{ gap: 8 }}>
                {toPost.slice(0, 4).map((b) => (
                  <Link key={b.id} className="btn small" href={`/pro/post/${b.id}`}>
                    Post {b.car ?? b.package_name} · {prettyDate(b.shoot_date)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {posts.length > 0 && (
            <div className="grid pros" style={{ marginTop: 16 }}>
              {posts.map((s) => <ShotCard key={s.id} s={s} showPro={false} />)}
            </div>
          )}
        </section>
      )}

      {myOffers.length > 0 && (
        <section>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2>Your offers</h2>
            <Link className="small" href="/requests">Find requests</Link>
          </div>
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
        </section>
      )}
    </main>
  );
}

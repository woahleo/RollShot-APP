import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import { prettyDate, today } from "@/lib/sun";
import Garage from "./Garage";

export default async function Me() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  if (profile.role === "pro") redirect("/pro");
  const [{ data: cars }, { data: requests }] = await Promise.all([
    supabase.from("cars").select("*, shoot_posts(count)").eq("owner_id", user.id).order("created_at"),
    supabase.from("requests").select("id, car, shoot_type, city, date_from, status, request_replies(count)").eq("client_id", user.id).eq("status", "open").gte("date_from", today()).order("date_from"),
  ]);
  const myRequests = (requests ?? []) as { id: string; car: string; shoot_type: string; city: string; date_from: string; request_replies: { count: number }[] }[];

  return (
    <main className="wrap">
      <h1>Garage<em>.</em></h1>
      <Garage
        userId={user.id}
        cars={((cars ?? []) as unknown as (Car & { public: boolean; shoot_posts: { count: number }[] })[]).map((c) => ({
          ...c,
          shots: c.shoot_posts?.[0]?.count ?? 0,
        }))}
      />
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
    </main>
  );
}

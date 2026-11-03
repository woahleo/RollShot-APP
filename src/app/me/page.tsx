import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import { prettyDate, today } from "@/lib/sun";
import Garage from "./Garage";
import AvatarUpload from "@/components/AvatarUpload";

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
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 style={{ marginBottom: 0 }}>Garage<em>.</em></h1>
        <Link className="small" href={`/u/${user.id}`}>See your profile</Link>
      </div>
      <div className="card me-card">
        <AvatarUpload userId={user.id} name={profile.name} avatar={profile.avatar ?? null} />
        <p className="small muted" style={{ margin: 0 }}>
          Creators see your photo, your name and your shared cars when they open your profile. Add photos of each car below so they know what they&apos;d be shooting.
        </p>
      </div>
      <Garage
        userId={user.id}
        cars={((cars ?? []) as unknown as (Car & { public: boolean; photos: string[]; shoot_posts: { count: number }[] })[]).map((c) => ({
          ...c,
          photos: c.photos ?? [],
          shots: c.shoot_posts?.[0]?.count ?? 0,
        }))}
      />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Requests</h2>
        <Link className="small" href="/requests/new">Post a request</Link>
      </div>
      {myRequests.length === 0 ? (
        <p className="muted">No open requests. Post a date and creators send you offers to choose from.</p>
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

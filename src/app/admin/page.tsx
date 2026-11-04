import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/supabase/server";
import { pushReady } from "@/lib/push";
import AdminUsers, { type AdminUser } from "./AdminUsers";
import PushSetup from "./PushSetup";

export const metadata: Metadata = { title: "Admin · Rollshot", robots: { index: false } };
export const dynamic = "force-dynamic";

type Counts = Record<string, number | boolean | string | null>;

/** Only accounts in the admins table can open this. Everyone else gets a plain 404. */
export default async function AdminPage() {
  const { supabase, user } = await getMe();
  if (!user) redirect("/signup?next=/admin");
  const { data: ok } = await supabase.rpc("is_admin");
  if (ok !== true) notFound();
  const [{ data: users }, { data: c }] = await Promise.all([supabase.rpc("admin_users"), supabase.rpc("admin_counts")]);
  const counts = (c ?? {}) as Counts;
  const n = (k: string) => Number(counts[k] ?? 0);
  const tiles = [
    { label: "People", value: n("users"), sub: `${n("week")} new this week` },
    { label: "Car owners", value: n("clients"), sub: "" },
    { label: "Creators", value: n("creators"), sub: "" },
    { label: "Bookings", value: n("bookings"), sub: `${n("upcoming")} coming up` },
    { label: "Open requests", value: n("open_requests"), sub: `${n("requests")} posted in all` },
    { label: "Messages", value: n("messages_week"), sub: "this week" },
  ];
  return (
    <main className="wrap" style={{ maxWidth: 980 }}>
      <p className="eyebrow" style={{ margin: 0 }}>Only you can see this</p>
      <h1 style={{ marginTop: 4 }}>Admin</h1>
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile">
            <span className="small muted">{t.label}</span>
            <b>{t.value.toLocaleString("en-US")}</b>
            {t.sub && <span className="small muted">{t.sub}</span>}
          </div>
        ))}
      </div>
      <AdminUsers users={(users ?? []) as AdminUser[]} />
      <PushSetup
        appReady={pushReady()}
        dbLinked={counts.push_linked === true}
        pgNet={counts.pg_net === true}
        devices={n("push_devices")}
        secret={pushReady() ? process.env.PUSH_SECRET! : null}
        linkedUrl={(counts.push_url as string | null) ?? null}
      />
    </main>
  );
}

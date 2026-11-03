import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Thread } from "@/lib/types";

type Row = Thread & {
  pro: { profiles: { name: string } | null } | null;
  client: { name: string } | null;
  messages: { body: string; created_at: string }[];
};

export default async function Inbox() {
  const { supabase, user } = await getMe();
  if (!user) redirect("/signup");
  const { data } = await supabase
    .from("threads")
    .select("*, pro:pros(profiles(name)), client:profiles!threads_client_id_fkey(name), messages(body, created_at)")
    .order("updated_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });
  const threads = (data ?? []) as Row[];

  return (
    <main className="wrap">
      <h1>Messages</h1>
      {threads.length === 0 && <p className="muted">No conversations yet. Open a shooter&apos;s page to say hi.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {threads.map((t) => {
          const other = t.pro_id === user.id ? t.client?.name : t.pro?.profiles?.name;
          return (
            <Link key={t.id} href={`/messages/${t.id}`} className="card" style={{ textDecoration: "none", display: "grid", gap: 2 }}>
              <h3 style={{ margin: 0 }}>{other ?? "Someone"}</h3>
              <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.messages[0]?.body ?? "No messages yet"}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

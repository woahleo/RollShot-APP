import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import PushToggle from "@/components/PushToggle";
import MarkRead from "./MarkRead";

export const metadata = { title: "Notifications · Rollshot" };

type Note = { id: string; kind: string; title: string; body: string | null; href: string; created_at: string; read_at: string | null };

const ICON: Record<string, string> = { request: "R", offer: "$", booking: "✓", crew: "C", signup: "+" };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export default async function NotificationsPage() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?next=/notifications");
  if (!profile) redirect("/onboarding");
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const notes = (data ?? []) as Note[];
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>Notifications</h1>
      <PushToggle />
      <MarkRead userId={user.id} any={notes.some((n) => !n.read_at)} />
      {notes.length === 0 ? (
        <p className="muted">
          Nothing yet. {profile.role === "pro"
            ? "You'll hear about new requests in your city, bookings and crew jobs here."
            : "You'll hear about offers on your requests and answers to your bookings here."}
        </p>
      ) : (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className={`note${n.read_at ? "" : " fresh"}`}>
                <span className={`note-icon ${n.kind}`} aria-hidden="true">{ICON[n.kind] ?? "•"}</span>
                <span className="note-text">
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                </span>
                <span className="note-time small muted">{ago(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

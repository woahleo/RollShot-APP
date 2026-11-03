"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = { id: string; thread_id: string; sender_id: string | null; kind: string; body: string; offer_name: string | null; created_at: string };
type Toast = { id: string; thread: string; from: string; body: string };

// Floating chat button, plus a pop-in notice at the top when a new message arrives.
export default function ChatBubble({ userId }: { userId: string }) {
  const path = usePathname();
  const router = useRouter();
  const [fresh, setFresh] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  useEffect(() => {
    const supabase = createClient();
    const names = new Map<string, string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new Set<string>();
    // Server time of the newest message seen so far, so device clocks don't matter.
    let since: string | null = null;
    const announce = async (m: Msg) => {
      if (m.sender_id === userId || seen.has(m.id)) return;
      seen.add(m.id);
      // Already looking at this chat: nothing to announce.
      if (pathRef.current === `/messages/${m.thread_id}`) return;
      setFresh(true);
      let from = "Rollshot";
      if (m.sender_id) {
        if (!names.has(m.sender_id)) {
          const { data } = await supabase.from("profiles").select("name").eq("id", m.sender_id).maybeSingle();
          names.set(m.sender_id, data?.name ?? "New message");
        }
        from = names.get(m.sender_id)!;
      }
      setToast({ id: m.id, thread: m.thread_id, from, body: m.kind === "offer" ? `Sent you an offer: ${m.offer_name}` : m.body });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
      if (pathRef.current === "/messages") router.refresh(); // keep the inbox list current
    };
    const ch = supabase
      .channel("bubble")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => announce(p.new as Msg))
      .subscribe();
    // Backup for when live updates are slow or blocked: check for new messages every few seconds.
    const check = async () => {
      if (since === null) {
        const { data } = await supabase.from("messages").select("created_at").order("created_at", { ascending: false }).limit(1);
        since = data?.[0]?.created_at ?? "1970-01-01T00:00:00Z";
        return;
      }
      const { data } = await supabase
        .from("messages")
        .select("id, thread_id, sender_id, kind, body, offer_name, created_at")
        .gt("created_at", since)
        .or(`sender_id.is.null,sender_id.neq.${userId}`)
        .order("created_at")
        .limit(5);
      if (!data?.length) return;
      since = data[data.length - 1].created_at;
      for (const m of data) await announce(m as Msg);
    };
    check();
    const poll = setInterval(() => document.visibilityState === "visible" && check(), 6000);
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [userId, router]);

  useEffect(() => {
    if (path.startsWith("/messages")) setFresh(false);
    if (toast && path === `/messages/${toast.thread}`) setToast(null);
  }, [path, toast]);

  return (
    <>
      {toast && (
        <Link key={toast.id} href={`/messages/${toast.thread}`} className="toast" role="status" onClick={() => setToast(null)}>
          <span className="toast-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="toast-text">
            <b>{toast.from}</b>
            <span>{toast.body}</span>
          </span>
          <button
            type="button"
            className="toast-x"
            aria-label="Dismiss"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setToast(null);
            }}
          >
            ×
          </button>
        </Link>
      )}
      {!path.startsWith("/messages/") && (
        <Link href="/messages" className="bubble" aria-label="Messages">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
          </svg>
          {fresh && <span className="dot" />}
        </Link>
      )}
    </>
  );
}

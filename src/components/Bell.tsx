"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The bell in the top bar, with a count of unread notifications. Updates live. */
export default function Bell({ userId }: { userId: string }) {
  const path = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const count = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      setUnread(count ?? 0);
    };
    count();
    const ch = supabase
      .channel("bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, count)
      .subscribe();
    const poll = setInterval(() => document.visibilityState === "visible" && count(), 30000);
    const onFocus = () => count();
    window.addEventListener("focus", onFocus);
    window.addEventListener("rs-notifications-read", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("rs-notifications-read", onFocus);
      supabase.removeChannel(ch);
    };
  }, [userId, path]);

  return (
    <Link href="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"} aria-current={path === "/notifications" ? "page" : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" strokeLinejoin="round" />
        <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
      {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

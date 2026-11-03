"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Floating chat button. Shows a dot when a message arrives from someone else.
export default function ChatBubble({ userId }: { userId: string }) {
  const path = usePathname();
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("bubble")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        if ((p.new as { sender_id: string | null }).sender_id !== userId) setFresh(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);
  useEffect(() => { if (path.startsWith("/messages")) setFresh(false); }, [path]);
  if (path.startsWith("/messages/")) return null;
  return (
    <Link href="/messages" className="bubble" aria-label="Messages">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
      </svg>
      {fresh && <span className="dot" />}
    </Link>
  );
}

"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Opening the page marks everything as seen, then the bell clears. */
export default function MarkRead({ userId, any }: { userId: string; any: boolean }) {
  useEffect(() => {
    if (!any) return;
    createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(() => window.dispatchEvent(new Event("rs-notifications-read")));
  }, [userId, any]);
  return null;
}

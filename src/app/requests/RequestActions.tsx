"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The one button a request card needs for whoever is looking at it. */
export default function RequestActions({ id, role, signedIn, own, thread }: {
  id: string; role: "pro" | "client" | null; signedIn: boolean; own: boolean; thread: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reply() {
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("reply_to_request", { p_request: id });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    router.push(`/messages/${data}?offer=1`);
  }
  async function close() {
    if (!confirm("Close this request? It comes off the board.")) return;
    setBusy(true);
    await createClient().from("requests").update({ status: "closed" }).eq("id", id);
    router.refresh();
  }

  if (own) return <button type="button" className="btn small" disabled={busy} onClick={close}>Close</button>;
  if (role === "pro") {
    if (thread) return <Link className="btn small" href={`/messages/${thread}`}>Open chat</Link>;
    return (
      <>
        <button type="button" className="btn solid small" disabled={busy} onClick={reply}>Reply with an offer</button>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </>
    );
  }
  if (!signedIn) return <Link className="btn small" href="/signup?role=pro&next=/requests">I shoot cars</Link>;
  return null;
}

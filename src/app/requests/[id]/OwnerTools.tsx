"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Edit or take down your own open request. */
export default function OwnerTools({ id, offers }: { id: string; offers: number }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function takeDown() {
    setBusy(true);
    setError("");
    const { error } = await createClient().from("requests").update({ status: "closed" }).eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    router.replace(`/requests/${id}`);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 8, margin: "4px 0 14px" }}>
      {sure ? (
        <div className="notice" style={{ display: "grid", gap: 8 }}>
          <span>Take this request down?{offers > 0 ? ` The ${offers === 1 ? "creator who offered hears" : `${offers} creators who offered hear`} about it.` : ""}</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn solid small" disabled={busy} onClick={takeDown}>Yes, take it down</button>
            <button type="button" className="btn small" onClick={() => setSure(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn small" href={`/requests/${id}/edit`}>Edit request</Link>
          <button type="button" className="btn small" onClick={() => setSure(true)}>Take down</button>
        </div>
      )}
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

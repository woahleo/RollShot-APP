"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mine = { price: number | null; note: string | null } | null;

/** What a request card lets the viewer do: owners see their offers, photographers send or edit one. */
export default function RequestActions({ id, role, signedIn, own, offers, mine, budget }: {
  id: string; role: "pro" | "client" | null; signedIn: boolean; own: boolean; offers: number; mine: Mine; budget: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(mine?.price ?? budget ?? ""));
  const [note, setNote] = useState(mine?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("offer_on_request", { p_request: id, p_price: Number(price), p_note: note });
    setBusy(false);
    if (error) return setError(error.message);
    setOpen(false);
    router.refresh();
  }

  if (own) return <Link className="btn solid small" href={`/requests/${id}`}>{offers ? `See ${offers} offer${offers === 1 ? "" : "s"}` : "Manage"}</Link>;
  if (role === "pro") {
    if (!open)
      return mine ? (
        <button type="button" className="btn small" onClick={() => setOpen(true)}>Your offer: ${mine.price} · Edit</button>
      ) : (
        <button type="button" className="btn solid small" onClick={() => setOpen(true)}>Make an offer</button>
      );
    return (
      <form className="offer-inline" onSubmit={send}>
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="$ price" inputMode="numeric" aria-label="Your price" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note, e.g. 25 edits + a reel" maxLength={300} aria-label="Note" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn solid small" disabled={busy || !price}>{mine ? "Update offer" : "Send offer"}</button>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
        </div>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </form>
    );
  }
  if (!signedIn) return <Link className="btn small" href="/signup?role=pro&next=/requests">I shoot cars</Link>;
  return null;
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/money";

type Mine = { price: number | null; note: string | null } | null;

/** What a request card lets the viewer do: owners see their offers, creators send or edit one. */
export default function RequestActions({ id, role, signedIn, own, offers, mine, budget, free = false }: {
  id: string; role: "pro" | "client" | null; signedIn: boolean; own: boolean; offers: number; mine: Mine; budget: number | null; free?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(mine?.price ?? (free ? 0 : budget ?? "")));
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
        <button type="button" className="btn small" onClick={() => setOpen(true)}>Your offer: {money(mine.price)} · Edit</button>
      ) : (
        <button type="button" className="btn solid small" onClick={() => setOpen(true)}>{free ? "Offer to shoot it" : "Make an offer"}</button>
      );
    return (
      <form className="offer-inline" onSubmit={send}>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={price === "0"} onClick={() => setPrice("0")}>Shoot it free</button>
          <button type="button" className="chip" aria-pressed={price !== "0"} onClick={() => setPrice(price === "0" ? "" : price)}>Name a price</button>
        </div>
        {free && <small className="muted">Free portfolio shoot. Shooting it free helps your chances, but you can still name a price.</small>}
        {price !== "0" && (
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="$ price" inputMode="numeric" aria-label="Your price" />
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note, e.g. 25 edits + a reel" maxLength={300} aria-label="Note" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn solid small" disabled={busy || !price}>{mine ? "Update offer" : price === "0" ? "Offer to shoot it free" : "Send offer"}</button>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
        </div>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </form>
    );
  }
  if (!signedIn) return <Link className="btn small" href="/signup?role=pro&next=/requests">I shoot cars</Link>;
  return null;
}

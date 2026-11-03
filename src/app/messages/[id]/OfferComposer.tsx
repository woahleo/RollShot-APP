"use client";
import { useState } from "react";
import MonthCalendar from "@/components/MonthCalendar";
import { createClient } from "@/lib/supabase/client";
import { prettyDate } from "@/lib/sun";
import type { Message, Package } from "@/lib/types";

const MAX = 5;

/** Photographer picks a package (or a custom price) and up to 5 dates to offer in the chat. */
export default function OfferComposer({ threadId, packages, openDates, onClose, onSent }: {
  threadId: string;
  packages: Package[];
  openDates: string[];
  onClose: () => void;
  onSent: (m: Message) => void;
}) {
  const [pkg, setPkg] = useState<string>(packages[0]?.id ?? "custom");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const open = new Set(openDates);

  function pick(d: string) {
    const next = new Set(dates);
    if (next.has(d)) next.delete(d);
    else if (next.size < MAX) next.add(d);
    else return setError(`Offer up to ${MAX} dates.`);
    setError("");
    setDates(next);
  }

  async function send() {
    const chosen = packages.find((k) => k.id === pkg);
    const offerName = chosen ? chosen.name : name.trim();
    const offerPrice = chosen ? chosen.price : Number(price);
    if (!offerName) return setError("Name the shoot.");
    if (!offerPrice || offerPrice <= 0) return setError("Add a price.");
    if (!dates.size) return setError("Pick at least one date.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: id, error } = await supabase.rpc("send_offer", {
      p_thread: threadId, p_name: offerName, p_price: offerPrice, p_dates: [...dates].sort(), p_note: note,
    });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const { data } = await supabase.from("messages").select("*").eq("id", id).single();
    setBusy(false);
    if (data) onSent(data as Message);
  }

  return (
    <div className="card offer-compose">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b style={{ fontWeight: 400 }}>Offer dates</b>
        <button type="button" className="btn small" onClick={onClose}>Cancel</button>
      </div>
      <div className="chips" style={{ margin: "10px 0" }}>
        {packages.map((k) => (
          <button key={k.id} type="button" className="chip" aria-pressed={pkg === k.id} onClick={() => setPkg(k.id)}>
            {k.name} · ${k.price}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={pkg === "custom"} onClick={() => setPkg("custom")}>Custom</button>
      </div>
      {pkg === "custom" && (
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <input style={{ flex: 2 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Shoot, e.g. Night rollers" maxLength={80} />
          <input style={{ flex: 1 }} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="$" inputMode="numeric" />
        </div>
      )}
      <p className="small muted" style={{ margin: "0 0 6px" }}>Tap up to {MAX} days. Circled days are already open on your calendar.</p>
      <MonthCalendar selected={dates} onPick={pick} isMarked={(d) => open.has(d)} startAt={openDates[0]} />
      {dates.size > 0 && <p className="small" style={{ margin: "8px 0 0" }}>{[...dates].sort().map(prettyDate).join(" · ")}</p>}
      <input style={{ marginTop: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. Meet at the bridge" maxLength={300} />
      {error && <p className="error" style={{ margin: "8px 0 0" }}>{error}</p>}
      <button type="button" className="btn pink" style={{ width: "100%", marginTop: 10 }} disabled={busy} onClick={send}>
        Send offer{dates.size ? ` (${dates.size} date${dates.size === 1 ? "" : "s"})` : ""}
      </button>
    </div>
  );
}


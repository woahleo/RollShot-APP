"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate, today } from "@/lib/sun";
import type { Message } from "@/lib/types";

/** An offer in the chat. The car owner taps a date and books it; the photographer sees its status. */
export default function OfferCard({ m, isPro, otherName, cars, onBooked }: {
  m: Message;
  isPro: boolean;
  otherName: string;
  cars: string[];
  onBooked: () => void;
}) {
  const [date, setDate] = useState("");
  const [car, setCar] = useState(cars[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const now = today();
  const dates = (m.offer_dates ?? []).filter((d) => d >= now);
  const booked = !!m.booking_id;

  async function book() {
    if (!date) return setError("Pick a date.");
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("accept_offer", { p_message: m.id, p_date: date, p_car: car });
    setBusy(false);
    if (error) return setError(error.message);
    onBooked();
  }

  return (
    <div className={`offer ${isPro ? "mine" : ""}`}>
      <span className="eyebrow">{isPro ? "Your offer" : "Offer"}</span>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>{m.offer_name}</b>
        <b>${m.offer_price}</b>
      </div>
      {m.body && <p className="small" style={{ margin: "4px 0 8px" }}>{m.body}</p>}
      {booked ? (
        <p className="small" style={{ margin: 0 }}>Booked ✓</p>
      ) : dates.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>These dates have passed.</p>
      ) : isPro ? (
        <>
          <div className="offer-dates">
            {dates.map((d) => <span key={d} className="chip">{prettyDate(d)}</span>)}
          </div>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Waiting for {otherName} to pick a date.</p>
        </>
      ) : (
        <>
          <div className="offer-dates">
            {dates.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={date === d} onClick={() => setDate(d)}>
                {prettyDate(d)} <span className="muted">· {goldenHour(d)}</span>
              </button>
            ))}
          </div>
          {date && (
            <>
              {cars.length > 1 ? (
                <select value={car} onChange={(e) => setCar(e.target.value)} style={{ marginTop: 8 }}>
                  {cars.map((c) => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input value={car} onChange={(e) => setCar(e.target.value)} placeholder="Your car, e.g. 2021 Black BMW M3" maxLength={120} style={{ marginTop: 8 }} />
              )}
              <button type="button" className="btn solid" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={book}>
                Book {prettyDate(date)} · ${m.offer_price}
              </button>
            </>
          )}
          {error && <p className="error" style={{ margin: "6px 0 0" }}>{error}</p>}
        </>
      )}
    </div>
  );
}

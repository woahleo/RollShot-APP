"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate, today } from "@/lib/sun";
import type { Booking } from "@/lib/types";

const LABEL: Record<Booking["status"], string> = {
  requested: "Waiting on shooter",
  confirmed: "Confirmed",
  declined: "Declined",
  rescheduled: "Rain checked",
};

/** One booking with the actions the viewer is allowed to take. */
export default function BookingRow({ b, who, asPro, openDates }: { b: Booking; who: string; asPro: boolean; openDates: string[] }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const upcoming = b.shoot_date >= today() && b.status !== "declined";
  const options = openDates.filter((d) => d >= today() && d !== b.shoot_date).sort();

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message);
    setMoving(false);
    router.refresh();
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0 }}>{who}</h3>
          <span className="small muted">
            {b.package_name} · ${b.price}
            {b.car ? ` · ${b.car}` : ""}
          </span>
        </div>
        <span className={`badge ${b.status}`}>{asPro && b.status === "requested" ? "New request" : LABEL[b.status]}</span>
      </div>
      <span className="small">
        {prettyDate(b.shoot_date)} · golden hour {goldenHour(b.shoot_date)}
        {b.rain_from ? <span className="muted"> · moved from {prettyDate(b.rain_from)}</span> : null}
      </span>
      {upcoming && (
        <div className="row">
          {asPro && b.status === "requested" && (
            <>
              <button className="btn solid small" disabled={busy} onClick={() => call("respond_booking", { p_booking: b.id, p_accept: true })}>Accept</button>
              <button className="btn small" disabled={busy} onClick={() => call("respond_booking", { p_booking: b.id, p_accept: false })}>Decline</button>
            </>
          )}
          <button className="btn small" onClick={() => setMoving(!moving)}>Rain check</button>
        </div>
      )}
      {moving && (
        <div>
          {options.length === 0 ? (
            <p className="small muted">No other open dates yet. Message to sort one out.</p>
          ) : (
            <div className="dates">
              {options.map((d) => (
                <button key={d} className="date" disabled={busy} onClick={() => call("rain_check", { p_booking: b.id, p_new_date: d })}>
                  <b>{prettyDate(d)}</b>
                  <small>{goldenHour(d)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

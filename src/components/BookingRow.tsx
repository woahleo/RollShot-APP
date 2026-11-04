"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prettyDate, today } from "@/lib/sun";
import type { Booking } from "@/lib/types";
import DateTile from "./DateTile";
import AddToCalendar from "./AddToCalendar";
import { prettyTime } from "@/lib/hours";

const LABEL: Record<Booking["status"], string> = {
  requested: "Waiting for them to accept",
  confirmed: "Confirmed",
  declined: "Declined",
  rescheduled: "Rain checked",
  cancelled: "Cancelled",
};

/** One booking with the actions the viewer is allowed to take. */
export default function BookingRow({ b, who, asPro, openDates, whoLate = 0 }: { b: Booking; who: string; asPro: boolean; openDates: string[]; whoLate?: number }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const upcoming = b.shoot_date >= today() && b.status !== "declined" && b.status !== "cancelled";
  const tomorrow = new Date(`${today()}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Matches the database rule: within 48 hours means the shoot is today or tomorrow, once it was accepted.
  const late = b.status !== "requested" && b.shoot_date <= tomorrow.toISOString().slice(0, 10);
  const options = openDates.filter((d) => d >= today() && d !== b.shoot_date).sort();

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message);
    setMoving(false);
    setCancelling(false);
    router.refresh();
  }

  return (
    <div className="card booking">
      <DateTile day={b.shoot_date} dim={!upcoming} />
      <div className="booking-main">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0 }}>{asPro ? <Link className="who-link" href={`/u/${b.client_id}`}>{who}</Link> : who}{whoLate > 0 && <span className="small muted" style={{ fontWeight: 300 }}> · {whoLate} late cancel{whoLate === 1 ? "" : "s"}</span>}</h3>
          <span className="small muted">
            {b.shoot_time ? `${prettyTime(b.shoot_time)} · ` : ""}
            {b.package_name} · ${b.price}
            {b.car ? ` · ${b.car}` : ""}
          </span>
        </div>
        <span className={`badge ${b.status}`}>{asPro && b.status === "requested" ? "New request" : LABEL[b.status]}{b.status === "cancelled" && b.late_cancel ? " late" : ""}</span>
      </div>
      {b.rain_from ? <span className="small muted">Moved from {prettyDate(b.rain_from)}</span> : null}
      {upcoming && (
        <div className="row">
          {asPro && b.status === "requested" && (
            <>
              <button className="btn solid small" disabled={busy} onClick={() => call("respond_booking", { p_booking: b.id, p_accept: true })}>Accept</button>
              <button className="btn small" disabled={busy} onClick={() => call("respond_booking", { p_booking: b.id, p_accept: false })}>Decline</button>
            </>
          )}
          {(b.status === "confirmed" || b.status === "rescheduled") && <AddToCalendar kind="booking" id={b.id} />}
          <button className="btn small" onClick={() => { setMoving(!moving); setCancelling(false); }}>Rain check</button>
          {!(asPro && b.status === "requested") && (
            <button className="btn small" onClick={() => { setCancelling(!cancelling); setMoving(false); }}>
              {b.status === "requested" ? "Withdraw" : "Cancel"}
            </button>
          )}
        </div>
      )}
      {cancelling && (
        <div className="notice" style={{ display: "grid", gap: 8 }}>
          <b style={{ fontWeight: 400 }}>{b.status === "requested" ? "Withdraw this request?" : "Cancel this shoot?"}</b>
          {late ? (
            <span>It&apos;s less than 48 hours away, so this counts as a <b style={{ fontWeight: 400 }}>late cancel</b> and shows on your profile. If it&apos;s the weather, use Rain check instead, it&apos;s free.</span>
          ) : (
            <span>Free to cancel. It&apos;s more than 48 hours away. If it&apos;s the weather, Rain check moves it instead.</span>
          )}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn solid small" disabled={busy} onClick={() => call("cancel_booking", { p_booking: b.id, p_reason: reason })}>
              {b.status === "requested" ? "Yes, withdraw" : late ? "Yes, cancel (late)" : "Yes, cancel"}
            </button>
            <button className="btn small" onClick={() => setCancelling(false)}>Keep it</button>
          </div>
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
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

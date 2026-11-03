"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prettyDate } from "@/lib/sun";
import type { Package } from "@/lib/types";
import MonthCalendar from "@/components/MonthCalendar";
import { isRange, prettyRange, prettyTime, startTimes, type Hours } from "@/lib/hours";

export default function BookForm({ packages, dates, hours = {}, cars, name }: { packages: Package[]; dates: string[]; hours?: Hours; cars: string[]; name: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(packages[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [car, setCar] = useState(cars[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openSet = new Set(dates);

  const first = name.split(" ")[0];
  const range = date && isRange(hours[date]) ? hours[date] : null;
  function pickDate(d: string) {
    setDate(d);
    setTime("");
    setError("");
  }
  // Why the Book now button can't be pressed yet, if it can't.
  const blocked = !packages.length && !dates.length
    ? `${first} hasn't set prices or opened dates yet. Message them below to ask.`
    : !packages.length
      ? `${first} hasn't set prices yet. Message them below to ask.`
      : !dates.length
        ? `${first} hasn't opened any dates yet. Message them below to ask when they can shoot.`
        : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    if (!date) return setError("Pick a circled date on the calendar.");
    if (range && !time) return setError("Pick a start time.");
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("request_booking", { p_package: pkg, p_date: date, p_car: car, p_time: range ? time : null });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/shoots?requested=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <p className="small" style={{ margin: "0 0 8px" }}><b>1.</b> Pick a package</p>
      {!packages.length && <p className="small muted" style={{ margin: "0 0 14px" }}>No packages yet.</p>}
      <div className="list" style={{ marginBottom: 14 }}>
        {packages.map((k) => (
          <label key={k.id} style={{ cursor: "pointer" }}>
            <span className="row" style={{ gap: 8 }}>
              <input type="radio" name="pkg" checked={pkg === k.id} onChange={() => setPkg(k.id)} style={{ width: "auto" }} />
              {k.name}
            </span>
            <b>${k.price}</b>
          </label>
        ))}
      </div>
      <p className="small" style={{ margin: "0 0 8px" }}><b>2.</b> Pick a date</p>
      <MonthCalendar selected={new Set(date ? [date] : [])} onPick={pickDate} isEnabled={(d) => openSet.has(d)} markEnabled startAt={dates[0]} />
      <p className="small" style={{ margin: "8px 0 14px" }}>
        {date ? (
          <>{prettyDate(date)} <span className="muted">· {range ? `${first} is free ${prettyRange(range)}` : "any time works, you'll agree on it in chat"}</span></>
        ) : (
          <span className="muted">{dates.length ? `Pink days are open (${dates.length}). Tap one to pick it.` : "No open dates yet."}</span>
        )}
      </p>
      {range && (
        <div className="field">
          <span>Start time</span>
          <div className="chips times">
            {startTimes(range).map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={time === t} onClick={() => { setTime(t); setError(""); }}>{prettyTime(t)}</button>
            ))}
          </div>
        </div>
      )}
      <label className="field">
        <span><b style={{ color: "var(--ink)" }}>3.</b> Your car</span>
        {cars.length > 1 ? (
          <select value={car} onChange={(e) => setCar(e.target.value)}>
            {cars.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input value={car} onChange={(e) => setCar(e.target.value)} placeholder="2021 Black BMW M3" maxLength={120} />
        )}
      </label>
      {blocked && <p className="notice small">{blocked}</p>}
      <button className="btn solid" style={{ width: "100%" }} disabled={busy || !!blocked}>Book now</button>
      <p className="small muted">Free to request. The photographer confirms, then chat fully opens. If it rains, move it for free.</p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

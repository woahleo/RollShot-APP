"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate } from "@/lib/sun";
import type { Package } from "@/lib/types";
import MonthCalendar from "@/components/MonthCalendar";

export default function BookForm({ packages, dates, cars, name }: { packages: Package[]; dates: string[]; cars: string[]; name: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(packages[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [car, setCar] = useState(cars[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openSet = new Set(dates);

  const first = name.split(" ")[0];
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
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("request_booking", { p_package: pkg, p_date: date, p_car: car });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/me?requested=1");
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
      <p className="small" style={{ margin: "0 0 8px" }}><b>2.</b> Pick a date <span className="muted">(golden hour shown)</span></p>
      <MonthCalendar selected={new Set(date ? [date] : [])} onPick={setDate} isEnabled={(d) => openSet.has(d)} markEnabled startAt={dates[0]} />
      <p className="small" style={{ margin: "8px 0 14px" }}>
        {date ? <>{prettyDate(date)} · golden hour {goldenHour(date)}</> : <span className="muted">{dates.length ? `Circled days are open (${dates.length}). Tap one to pick it.` : "No open dates yet."}</span>}
      </p>
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
      <button className="btn pink" style={{ width: "100%" }} disabled={busy || !!blocked}>Book now</button>
      <p className="small muted">Free to request. The photographer confirms, then chat fully opens. If it rains, move it for free.</p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

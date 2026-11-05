"use client";
import { useRef, useState } from "react";
import MonthCalendar from "@/components/MonthCalendar";
import { createClient } from "@/lib/supabase/client";
import { prettyDate, today } from "@/lib/sun";
import { PRESETS, isRange, prettyRange, type Hours } from "@/lib/hours";

type State = { open: Set<string>; hours: Hours };

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * The creator's calendar. Tap a free day to open it. Tap an open day to pick it: then set its hours
 * or close it. Tapping again never closes a day by accident. Quick buttons open a batch of days at once.
 * Days with a booked shoot have a dot and can't be opened again.
 */
export default function OpenDates({ userId, initial, initialHours, booked = [], tz }: { userId: string; initial: string[]; initialHours: Hours; booked?: string[]; tz?: string }) {
  const now = today(tz);
  const start = initial.filter((d) => d >= now);
  const busy = new Set(booked);
  const [s, setS] = useState<State>(() => ({
    open: new Set(start),
    hours: Object.fromEntries(Object.entries(initialHours ?? {}).filter(([d, r]) => start.includes(d) && isRange(r))),
  }));
  const [focus, setFocus] = useState<string | null>(null);
  const [custom, setCustom] = useState({ from: "16:00", to: "20:00" });
  const [showCustom, setShowCustom] = useState(false);
  const [status, setStatus] = useState("");
  const latest = useRef(s);

  async function save(next: State) {
    latest.current = next;
    setS(next);
    setStatus("Saving…");
    const hours = Object.fromEntries(Object.entries(next.hours).filter(([d]) => next.open.has(d)));
    const { error } = await createClient()
      .from("pros")
      .update({ open_dates: [...next.open].sort(), open_hours: hours, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (latest.current === next) setStatus(error ? error.message : "Saved");
  }

  function pick(d: string) {
    setShowCustom(false);
    if (latest.current.open.has(d)) return setFocus(d);
    const open = new Set(latest.current.open).add(d);
    setFocus(d);
    save({ open, hours: latest.current.hours });
  }

  function close(d: string) {
    const open = new Set(latest.current.open);
    const hours = { ...latest.current.hours };
    open.delete(d);
    delete hours[d];
    setFocus(null);
    save({ open, hours });
  }

  /** Open a batch of days (skipping booked ones), keeping any hours already set. */
  function openMany(days: string[]) {
    const open = new Set(latest.current.open);
    days.filter((d) => d >= now && !busy.has(d)).forEach((d) => open.add(d));
    save({ open, hours: latest.current.hours });
  }
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  const weekends = Array.from({ length: 28 }, (_, i) => addDays(now, i)).filter((d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay()));

  function setHours(range: string | null, all = false) {
    if (!focus) return;
    const hours = { ...latest.current.hours };
    for (const day of all ? [...latest.current.open] : [focus]) {
      if (range) hours[day] = range;
      else delete hours[day];
    }
    save({ open: latest.current.open, hours });
  }

  const count = [...s.open].filter((d) => d >= now).length;
  const current = focus ? s.hours[focus] : undefined;
  const isCustom = !!current && !PRESETS.some((p) => p.range === current);
  const customOk = isRange(`${custom.from}-${custom.to}`);

  return (
    <div className="dates-editor">
      <div>
        <div className="chips quick">
          <button type="button" className="chip" onClick={() => openMany(weekends)}>Open weekends</button>
          <button type="button" className="chip" onClick={() => openMany(next7)}>Open next 7 days</button>
          {count > 0 && <button type="button" className="chip" onClick={() => { setFocus(null); save({ open: new Set(), hours: {} }); }}>Close all</button>}
        </div>
        <MonthCalendar tz={tz} selected={s.open} onPick={pick} focus={focus} isEnabled={(d) => !busy.has(d)} isDotted={(d) => busy.has(d)} />
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          {count ? `${count} open day${count === 1 ? "" : "s"}` : "No open days yet"}
          {busy.size > 0 ? " · dots are booked shoots" : ""}
          {status ? ` · ${status}` : ""}
        </p>
      </div>

      <div className="hours-card">
        {focus && s.open.has(focus) ? (
          <>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <b style={{ fontWeight: 400 }}>{prettyDate(focus)}</b>
              <span className="small muted">{current ? prettyRange(current) : "Any time"}</span>
            </div>
            <span className="small muted">Hours car owners can pick a start time in</span>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={!current} onClick={() => { setShowCustom(false); setHours(null); }}>Any time</button>
              {PRESETS.map((p) => (
                <button type="button" key={p.label} className="chip" aria-pressed={current === p.range} onClick={() => { setShowCustom(false); setHours(p.range); }}>
                  {p.label} <span className="muted">{prettyRange(p.range)}</span>
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={isCustom} onClick={() => setShowCustom(!showCustom)}>Custom</button>
            </div>
            {showCustom && (
              <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                <label className="field" style={{ margin: 0, flex: 1 }}><span>From</span>
                  <input type="time" step={1800} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
                </label>
                <label className="field" style={{ margin: 0, flex: 1 }}><span>To</span>
                  <input type="time" step={1800} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
                </label>
                <button type="button" className="btn small solid" disabled={!customOk} onClick={() => setHours(`${custom.from}-${custom.to}`)}>Set</button>
              </div>
            )}
            {showCustom && !customOk && <span className="small error">The end time has to be after the start time.</span>}
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              {count > 1 ? (
                <button type="button" className="link small" onClick={() => setHours(current ?? null, true)}>Use for all {count} open days</button>
              ) : <span />}
              <button type="button" className="btn small" onClick={() => close(focus)}>Close this day</button>
            </div>
          </>
        ) : (
          <>
            <b style={{ fontWeight: 400 }}>Your open days</b>
            <span className="small muted">
              Tap a day to open it for bookings. Tap an open day to set its hours or close it. Car owners only see open days.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

"use client";
import { useRef, useState } from "react";
import MonthCalendar from "@/components/MonthCalendar";
import { createClient } from "@/lib/supabase/client";
import { prettyDate, today } from "@/lib/sun";
import { PRESETS, isRange, prettyRange, type Hours } from "@/lib/hours";

type State = { open: Set<string>; hours: Hours };

/**
 * Tap a day to open it (tap again to close it). Right after opening a day you can give it hours,
 * like 4 to 8 PM, so car owners pick a start time inside them. No hours means any time works.
 */
export default function OpenDates({ userId, initial, initialHours }: { userId: string; initial: string[]; initialHours: Hours }) {
  const start = initial.filter((d) => d >= today());
  const [s, setS] = useState<State>(() => ({
    open: new Set(start),
    hours: Object.fromEntries(Object.entries(initialHours ?? {}).filter(([d, r]) => start.includes(d) && isRange(r))),
  }));
  const [editing, setEditing] = useState<string | null>(null);
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
    if (latest.current === next) setStatus(error ? error.message : "Saved.");
  }

  function toggle(d: string) {
    const open = new Set(latest.current.open);
    const hours = { ...latest.current.hours };
    if (open.has(d)) {
      open.delete(d);
      delete hours[d];
      if (editing === d) setEditing(null);
    } else {
      open.add(d);
      setEditing(d);
      setShowCustom(false);
    }
    save({ open, hours });
  }

  function setHours(d: string, range: string | null, all = false) {
    const hours = { ...latest.current.hours };
    const days = all ? [...latest.current.open] : [d];
    for (const day of days) {
      if (range) hours[day] = range;
      else delete hours[day];
    }
    save({ open: latest.current.open, hours });
  }

  const upcoming = [...s.open].sort();
  const current = editing ? s.hours[editing] : undefined;
  const customOk = isRange(`${custom.from}-${custom.to}`);

  return (
    <>
      <MonthCalendar selected={s.open} onPick={toggle} />
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {upcoming.length ? `${upcoming.length} open day${upcoming.length === 1 ? "" : "s"}. ` : "No open days yet. "}
        {status}
      </p>

      {editing && s.open.has(editing) && (
        <div className="hours-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontWeight: 400 }}>Hours for {prettyDate(editing)}</b>
            <button type="button" className="link small" onClick={() => setEditing(null)}>Done</button>
          </div>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={!current} onClick={() => setHours(editing, null)}>Any time</button>
            {PRESETS.map((p) => (
              <button type="button" key={p.label} className="chip" aria-pressed={current === p.range} onClick={() => { setShowCustom(false); setHours(editing, p.range); }}>
                {p.label} <span className="muted">{prettyRange(p.range)}</span>
              </button>
            ))}
            <button type="button" className="chip"
              aria-pressed={!!current && !PRESETS.some((p) => p.range === current)}
              onClick={() => setShowCustom(!showCustom)}>
              Custom{current && !PRESETS.some((p) => p.range === current) ? ` ${prettyRange(current)}` : ""}
            </button>
          </div>
          {showCustom && (
            <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
              <label className="field" style={{ margin: 0, flex: 1 }}><span>From</span>
                <input type="time" step={1800} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              </label>
              <label className="field" style={{ margin: 0, flex: 1 }}><span>To</span>
                <input type="time" step={1800} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
              </label>
              <button type="button" className="btn small solid" disabled={!customOk} onClick={() => setHours(editing, `${custom.from}-${custom.to}`)}>Set</button>
            </div>
          )}
          {showCustom && !customOk && <span className="small error">The end time has to be after the start time.</span>}
          {upcoming.length > 1 && (
            <button type="button" className="link small" style={{ justifySelf: "start" }} onClick={() => setHours(editing, current ?? null, true)}>
              Use {current ? prettyRange(current) : "Any time"} for all {upcoming.length} open days
            </button>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="picked">
          {upcoming.slice(0, 12).map((d) => (
            <button type="button" key={d} aria-pressed={editing === d} onClick={() => { setEditing(d); setShowCustom(false); }} title="Set hours">
              {prettyDate(d)}
              <small>{s.hours[d] ? prettyRange(s.hours[d]) : "Any time"}</small>
            </button>
          ))}
          {upcoming.length > 12 && <span>+{upcoming.length - 12} more</span>}
        </div>
      )}
      {upcoming.length > 0 && !editing && <p className="small muted" style={{ margin: "6px 0 0" }}>Tap a day below to set its hours.</p>}
    </>
  );
}

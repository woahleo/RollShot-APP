"use client";
import { useRef, useState } from "react";
import MonthCalendar from "@/components/MonthCalendar";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate, today } from "@/lib/sun";

export default function OpenDates({ userId, initial }: { userId: string; initial: string[] }) {
  const [open, setOpen] = useState(() => new Set(initial.filter((d) => d >= today())));
  const [state, setState] = useState("");
  const latest = useRef(open);

  async function toggle(d: string) {
    const next = new Set(latest.current);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    latest.current = next;
    setOpen(next);
    setState("Saving…");
    const { error } = await createClient()
      .from("pros")
      .update({ open_dates: [...next].sort(), updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (latest.current === next) setState(error ? error.message : "Saved.");
  }

  const upcoming = [...open].sort();
  return (
    <>
      <MonthCalendar selected={open} onPick={toggle} />
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {upcoming.length ? `${upcoming.length} open day${upcoming.length === 1 ? "" : "s"}. ` : "No open days yet. "}
        {state}
      </p>
      {upcoming.length > 0 && (
        <div className="picked">
          {upcoming.slice(0, 8).map((d) => (
            <span key={d}>{prettyDate(d)} · golden hour {goldenHour(d)}</span>
          ))}
          {upcoming.length > 8 && <span>+{upcoming.length - 8} more</span>}
        </div>
      )}
    </>
  );
}

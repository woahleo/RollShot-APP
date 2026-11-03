"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate, today } from "@/lib/sun";

function nextDays(n: number) {
  const start = new Date(today() + "T12:00:00");
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });
}

export default function OpenDates({ userId, initial }: { userId: string; initial: string[] }) {
  const [open, setOpen] = useState(new Set(initial));
  const [state, setState] = useState<"" | "saving" | "saved" | string>("");
  const days = nextDays(42);

  async function toggle(d: string) {
    const next = new Set(open);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setOpen(next);
    setState("saving");
    const keep = [...next].filter((x) => x >= today()).sort();
    const { error } = await createClient().from("pros").update({ open_dates: keep, updated_at: new Date().toISOString() }).eq("id", userId);
    setState(error ? error.message : "saved");
  }

  return (
    <>
      <div className="dates">
        {days.map((d) => (
          <button key={d} className="date" aria-pressed={open.has(d)} onClick={() => toggle(d)}>
            <b>{prettyDate(d)}</b>
            <small>{goldenHour(d)}</small>
          </button>
        ))}
      </div>
      <p className="small muted">{state === "saving" ? "Saving…" : state === "saved" ? "Saved." : state}</p>
    </>
  );
}

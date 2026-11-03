"use client";
import { useState } from "react";
import { today } from "@/lib/sun";

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type Props = {
  selected: Set<string>;
  onPick: (day: string) => void;
  /** Days that can be tapped. Past days are never tappable. */
  isEnabled?: (day: string) => boolean;
  monthsAhead?: number;
  /** Ring the tappable days, for when only a few are open. */
  markEnabled?: boolean;
  /** Ring these days too (e.g. a photographer's already-open days). */
  isMarked?: (day: string) => boolean;
  /** Open on the month of this day (e.g. the first open date) instead of this month. */
  startAt?: string;
};

/** A compact month grid: tap days to pick them, arrows to change month. */
export default function MonthCalendar({ selected, onPick, isEnabled = () => true, monthsAhead = 3, markEnabled = false, isMarked, startAt }: Props) {
  const now = today();
  const [y0, m0] = now.split("-").map(Number);
  const [offset, setOffset] = useState(() => {
    if (!startAt || startAt <= now) return 0;
    const [y1, m1] = startAt.split("-").map(Number);
    return Math.min((y1 - y0) * 12 + (m1 - m0), monthsAhead - 1);
  });
  const first = new Date(y0, m0 - 1 + offset, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
  const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="btn small" onClick={() => setOffset(offset - 1)} disabled={offset === 0} aria-label="Previous month">‹</button>
        <b>{title}</b>
        <button type="button" className="btn small" onClick={() => setOffset(offset + 1)} disabled={offset >= monthsAhead - 1} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid">
        {WEEK.map((w, i) => <span key={i} className="cal-dow">{w}</span>)}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className="cal-day"
              aria-pressed={selected.has(d)}
              aria-label={d}
              data-today={d === now || undefined}
              data-open={(d >= now && ((markEnabled && isEnabled(d)) || isMarked?.(d))) || undefined}
              disabled={d < now || !isEnabled(d)}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

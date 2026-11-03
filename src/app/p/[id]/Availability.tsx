"use client";
import MonthCalendar from "@/components/MonthCalendar";
import { prettyDate } from "@/lib/sun";
import { isRange, prettyRange, type Hours } from "@/lib/hours";

/** Read-only view of a photographer's open days, for people who can't book from this account. */
export default function Availability({ dates, hours = {} }: { dates: string[]; hours?: Hours }) {
  const open = new Set(dates);
  return (
    <>
      <MonthCalendar selected={new Set()} onPick={() => {}} isEnabled={(d) => open.has(d)} markEnabled startAt={dates[0]} />
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {dates.length ? "Pink days are open." : "No open dates yet."}
      </p>
      {dates.length > 0 && (
        <div className="picked">
          {dates.slice(0, 6).map((d) => (
            <span key={d}>{prettyDate(d)} <small>{isRange(hours[d]) ? prettyRange(hours[d]) : "Any time"}</small></span>
          ))}
        </div>
      )}
    </>
  );
}

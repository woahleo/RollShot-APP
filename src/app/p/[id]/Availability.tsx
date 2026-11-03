"use client";
import MonthCalendar from "@/components/MonthCalendar";

/** Read-only view of a photographer's open days, for people who can't book from this account. */
export default function Availability({ dates }: { dates: string[] }) {
  const open = new Set(dates);
  return (
    <>
      <MonthCalendar selected={new Set()} onPick={() => {}} isEnabled={(d) => open.has(d)} markEnabled startAt={dates[0]} />
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {dates.length ? "Pink days are open." : "No open dates yet."}
      </p>
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

/** "Add to calendar", then Apple/Outlook (an .ics file the phone opens in Calendar) or Google. */
export default function AddToCalendar({ kind, id }: { kind: "booking" | "gig"; id: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const base = `/api/calendar/${kind}/${id}`;
  return (
    <div className="addcal" ref={box}>
      <button type="button" className="btn small" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
          <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M12 13v4M10 15h4" strokeLinecap="round" />
        </svg>
        Add to calendar
      </button>
      {open && (
        <div className="addcal-menu" role="menu">
          <a href={base} role="menuitem" onClick={() => setOpen(false)}>Apple or Outlook</a>
          <a href={`${base}?to=google`} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpen(false)}>Google Calendar</a>
        </div>
      )}
    </div>
  );
}

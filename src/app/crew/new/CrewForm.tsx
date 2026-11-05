"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CITIES } from "@/lib/types";
import { prettyDate, today } from "@/lib/sun";
import { CREW_ROLES, ROLE_HINT, type CrewRole } from "@/lib/crew";

const plus = (d: string, days: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
};

export type GigDraft = { id: string; role: CrewRole; city: string; date: string; time: string | null; pay: number; note: string | null; replies: number };

/** Post a crew job, or (with a target) offer it to one creator directly. With a gig, edits that job. */
export default function CrewForm({ city: startCity, target, gig }: { city: string; target?: { id: string; name: string; role: CrewRole }; gig?: GigDraft }) {
  const router = useRouter();
  const now = today();
  const [role, setRole] = useState<CrewRole>(gig?.role ?? target?.role ?? "Second shooter");
  const [city, setCity] = useState(gig?.city ?? startCity);
  const [date, setDate] = useState(gig?.date ?? plus(now, 7));
  const [time, setTime] = useState(gig?.time?.slice(0, 5) ?? "");
  const [pay, setPay] = useState(gig ? String(gig.pay) : "");
  const [note, setNote] = useState(gig?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = target?.name.split(" ")[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || date < now) return setError("Pick a date from today on.");
    if (!pay || Number(pay) < 1) return setError("Add what you'll pay.");
    setBusy(true);
    setError("");
    const fields = { p_role: role, p_city: city, p_date: date, p_time: time || null, p_pay: Number(pay), p_note: note.trim() || null };
    const { error } = gig
      ? await createClient().rpc("edit_gig", { p_gig: gig.id, ...fields })
      : await createClient().rpc("post_gig", { ...fields, p_target: target?.id ?? null });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(gig ? "/crew?edited=1" : target ? "/crew?sent=1" : "/crew?posted=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 16 }}>
      <div className="field">
        <span>{target ? `What you need ${first} for` : "Who you need"}</span>
        <div className="chips">
          {CREW_ROLES.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>
        <small className="muted">{ROLE_HINT[role]}</small>
      </div>
      <label className="field">
        <span>City</span>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <label className="field" style={{ flex: "1 1 160px" }}>
          <span>Shoot date</span>
          <input type="date" value={date} min={now} onChange={(e) => setDate(e.target.value)} />
          {date && <small className="muted">{prettyDate(date)}</small>}
        </label>
        <label className="field" style={{ flex: "1 1 140px" }}>
          <span>Start time (optional)</span>
          <input type="time" value={time} step={1800} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Pay</span>
        <input value={pay} onChange={(e) => setPay(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="$" inputMode="numeric" />
        <small className="muted">What you&apos;ll pay them for the job. You settle it between you for now.</small>
      </label>
      <label className="field">
        <span>Details (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Rollers on the Rickenbacker at sunset. Bring a gimbal." />
      </label>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn solid" disabled={busy}>{gig ? "Save changes" : target ? `Send offer to ${first}` : "Post job"}</button>
      <p className="small muted" style={{ margin: 0 }}>
        {gig
          ? target
            ? `${first} gets a note in chat with the new details.`
            : gig.replies
              ? `The ${gig.replies === 1 ? "creator who replied gets" : `${gig.replies} creators who replied get`} a notification with the new details.`
              : "Creators see the new details on their Crew page right away."
          : target
          ? `${first} gets it in chat and on their Crew page, and can accept or decline.`
          : "Creators on Rollshot see it on their Crew page and can say they're in. You pick one."}
      </p>
    </form>
  );
}

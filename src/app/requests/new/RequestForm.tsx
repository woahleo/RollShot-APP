"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SHOOT_TYPES } from "@/lib/types";
import CityOptions from "@/components/CityOptions";
import { tzOf } from "@/lib/cities";
import { prettyDate, today } from "@/lib/sun";

const KINDS = [
  { key: "either", label: "Either" },
  { key: "photo", label: "Photos" },
  { key: "video", label: "Video" },
] as const;

const plus = (d: string, days: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
};

export type RequestDraft = {
  id: string; car: string; shoot_type: string; kind: string; city: string; date: string; budget: number | null; free: boolean; note: string | null; offers: number;
};

/** Post a request, or with a draft, change one that's still open. */
export default function RequestForm({ cars: garage, draft, city: startCity = "" }: { cars: string[]; draft?: RequestDraft; city?: string }) {
  const router = useRouter();
  const cars = draft && !garage.includes(draft.car) ? [draft.car, ...garage] : garage;
  const [car, setCar] = useState(draft?.car ?? cars[0] ?? "");
  const [shoot, setShoot] = useState<string>(draft?.shoot_type ?? SHOOT_TYPES[0]);
  const [kind, setKind] = useState<string>(draft?.kind ?? "either");
  const [city, setCity] = useState<string>(draft?.city ?? startCity);
  const now = today(tzOf(city));
  const [date, setDate] = useState(draft?.date ?? plus(now, 7));
  const [budget, setBudget] = useState(draft?.budget ? String(draft.budget) : "");
  const [free, setFree] = useState(draft?.free ?? false);
  const [note, setNote] = useState(draft?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (car.trim().length < 2) return setError("Add your car.");
    if (!city) return setError("Pick the city for the shoot.");
    if (!date || date < now) return setError("Pick a date from today on.");
    setBusy(true);
    setError("");
    const fields = {
      car: car.trim(), shoot_type: shoot, kind, city, date_from: date, date_to: date,
      budget: !free && budget ? Number(budget) : null, free, note: note.trim() || null,
    };
    const supabase = createClient();
    const { error } = draft
      ? await supabase.from("requests").update(fields).eq("id", draft.id)
      : await supabase.from("requests").insert(fields);
    setBusy(false);
    if (error) return setError(error.message);
    router.push(draft ? `/requests/${draft.id}?edited=1` : "/requests?posted=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 16 }}>
      <label className="field">
        <span>Car</span>
        {cars.length > 1 ? (
          <select value={car} onChange={(e) => setCar(e.target.value)}>
            {cars.map((c) => <option key={c}>{c}</option>)}
          </select>
        ) : (
          <input value={car} onChange={(e) => setCar(e.target.value)} placeholder="2021 Black BMW M3" maxLength={120} />
        )}
      </label>
      <div className="field">
        <span>What kind of shoot</span>
        <div className="chips">
          {SHOOT_TYPES.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={shoot === t} onClick={() => setShoot(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Photos or video</span>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k.key} type="button" className="chip" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>City</span>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="" disabled>Pick a city</option>
          <CityOptions />
        </select>
      </label>
      <label className="field">
        <span>Shoot date</span>
        <input type="date" value={date} min={now} onChange={(e) => setDate(e.target.value)} />
        {date && <small className="muted">{prettyDate(date)}</small>}
      </label>
      <div className="field">
        <span>Paid or free</span>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={!free} onClick={() => setFree(false)}>I&apos;ll pay</button>
          <button type="button" className="chip" aria-pressed={free} onClick={() => setFree(true)}>Free portfolio shoot</button>
        </div>
        <small className="muted">
          {free
            ? "Creators who are building their portfolio shoot it for free. Some may still name a price, and you pick who you want."
            : "Creators send you a price. A budget helps them offer the right package."}
        </small>
      </div>
      {!free && (
        <label className="field">
          <span>Budget (optional)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="$" inputMode="numeric" />
        </label>
      )}
      <label className="field">
        <span>Anything else (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Just got it wrapped, want rollers on the bridge at sunset." />
      </label>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn solid" disabled={busy}>{draft ? "Save changes" : "Post request"}</button>
      {draft && draft.offers > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          {draft.offers === 1 ? "The creator who sent an offer gets" : `The ${draft.offers} creators who sent offers get`} a notification with the new details. Their offers stay, so check they still fit.
        </p>
      )}
      <p className="small muted" style={{ margin: 0 }}>Phone numbers and handles aren&apos;t allowed here. You&apos;ll chat in Rollshot.</p>
    </form>
  );
}

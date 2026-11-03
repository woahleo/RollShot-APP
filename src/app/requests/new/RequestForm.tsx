"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CITIES, SHOOT_TYPES } from "@/lib/types";
import { goldenHour, prettyDate, today } from "@/lib/sun";

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

export default function RequestForm({ cars }: { cars: string[] }) {
  const router = useRouter();
  const now = today();
  const [car, setCar] = useState(cars[0] ?? "");
  const [shoot, setShoot] = useState<string>(SHOOT_TYPES[0]);
  const [kind, setKind] = useState<string>("either");
  const [city, setCity] = useState<string>(CITIES[0]);
  const [date, setDate] = useState(plus(now, 7));
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (car.trim().length < 2) return setError("Add your car.");
    if (!date || date < now) return setError("Pick a date from today on.");
    setBusy(true);
    setError("");
    const { error } = await createClient().from("requests").insert({
      car: car.trim(), shoot_type: shoot, kind, city, date_from: date, date_to: date,
      budget: budget ? Number(budget) : null, note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/requests?posted=1");
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
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Shoot date</span>
        <input type="date" value={date} min={now} onChange={(e) => setDate(e.target.value)} />
        {date && <small className="muted">{prettyDate(date)} · golden hour {goldenHour(date)}</small>}
      </label>
      <label className="field">
        <span>Budget (optional)</span>
        <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="$" inputMode="numeric" />
      </label>
      <label className="field">
        <span>Anything else (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Just got it wrapped, want rollers on the bridge at sunset." />
      </label>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn solid" disabled={busy}>Post request</button>
      <p className="small muted" style={{ margin: 0 }}>Phone numbers and handles aren&apos;t allowed here. You&apos;ll chat in Rollshot.</p>
    </form>
  );
}

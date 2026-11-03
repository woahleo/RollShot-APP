"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goldenHour, prettyDate } from "@/lib/sun";
import type { Package } from "@/lib/types";

export default function BookForm({ packages, dates, cars }: { packages: Package[]; dates: string[]; cars: string[] }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(packages[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [car, setCar] = useState(cars[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!packages.length || !dates.length) {
    return <p className="small muted">{!packages.length ? "No packages yet." : "No open dates right now."} Message them below to ask when they can shoot.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError("Pick a date.");
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("request_booking", { p_package: pkg, p_date: date, p_car: car });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/me?requested=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <p className="small" style={{ margin: "0 0 8px" }}><b>1.</b> Pick a package</p>
      <div className="list" style={{ marginBottom: 14 }}>
        {packages.map((k) => (
          <label key={k.id} style={{ cursor: "pointer" }}>
            <span className="row" style={{ gap: 8 }}>
              <input type="radio" name="pkg" checked={pkg === k.id} onChange={() => setPkg(k.id)} style={{ width: "auto" }} />
              {k.name}
            </span>
            <b>${k.price}</b>
          </label>
        ))}
      </div>
      <p className="small" style={{ margin: "0 0 8px" }}><b>2.</b> Pick a date <span className="muted">(golden hour shown)</span></p>
      <div className="dates" style={{ marginBottom: 14 }}>
        {dates.map((d) => (
          <button type="button" key={d} className="date" aria-pressed={date === d} onClick={() => setDate(d)}>
            <b>{prettyDate(d)}</b>
            <small>{goldenHour(d)}</small>
          </button>
        ))}
      </div>
      <label className="field">
        <span><b style={{ color: "var(--ink)" }}>3.</b> Your car</span>
        {cars.length > 1 ? (
          <select value={car} onChange={(e) => setCar(e.target.value)}>
            {cars.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input value={car} onChange={(e) => setCar(e.target.value)} placeholder="2021 Black BMW M3" maxLength={120} />
        )}
      </label>
      <button className="btn pink" style={{ width: "100%" }} disabled={busy}>Book now</button>
      <p className="small muted">Free to request. The photographer confirms, then chat fully opens. If it rains, move it for free.</p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

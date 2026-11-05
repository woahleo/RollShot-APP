"use client";
import CityOptions from "@/components/CityOptions";
import { MAX_CITIES } from "@/lib/cities";

/** Up to 2 more cities a creator works in, on top of their home city. */
export default function MoreCities({ home, value, onChange }: { home: string; value: string[]; onChange: (next: string[]) => void }) {
  const picked = value.filter((c) => c !== home);
  const room = MAX_CITIES - 1 - picked.length;
  return (
    <div className="field">
      <span>Also shoot in (up to {MAX_CITIES - 1} more)</span>
      {picked.length > 0 && (
        <div className="chips">
          {picked.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed onClick={() => onChange(picked.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
              {c} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      {room > 0 && (
        <select value="" onChange={(e) => e.target.value && e.target.value !== home && !picked.includes(e.target.value) && onChange([...picked, e.target.value])} aria-label="Add a city">
          <option value="">{picked.length ? "Add another city" : "Add a city"}</option>
          <CityOptions />
        </select>
      )}
    </div>
  );
}

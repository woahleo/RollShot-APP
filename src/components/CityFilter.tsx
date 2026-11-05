"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CITY_GROUPS } from "@/lib/cities";

/**
 * A city dropdown for the creators list and the requests board. It keeps the page's other filters,
 * and "All cities" sets city=all so a page with a default city can still show everything.
 */
export default function CityFilter({ value, counts, noun = "creators", mine = [] }: { value: string; counts?: Record<string, number>; noun?: string; mine?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  function go(city: string) {
    const p = new URLSearchParams(sp.toString());
    p.set("city", city);
    router.push(`${path}?${p}`);
  }
  return (
    <label className="city-filter">
      <span className="sr-only">City</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      <select value={value} onChange={(e) => go(e.target.value)} aria-label="City">
        {mine.length > 1 && <option value="mine">My cities ({mine.join(", ")})</option>}
        <option value="all">All cities</option>
        {CITY_GROUPS.map((g) => (
          <optgroup key={g.region} label={g.region}>
            {g.cities.map((c) => {
              const n = counts?.[c.name];
              return (
                <option key={c.name} value={c.name}>
                  {c.name}, {c.state}{n ? ` · ${n} ${n === 1 ? noun.replace(/s$/, "") : noun}` : ""}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

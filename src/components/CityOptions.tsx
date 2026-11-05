import { CITY_GROUPS } from "@/lib/cities";

/** The <option>s for a city <select>, grouped by region so the phone's picker is easy to scan. */
export default function CityOptions() {
  return (
    <>
      {CITY_GROUPS.map((g) => (
        <optgroup key={g.region} label={g.region}>
          {g.cities.map((c) => (
            <option key={c.name} value={c.name}>{c.name}, {c.state}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

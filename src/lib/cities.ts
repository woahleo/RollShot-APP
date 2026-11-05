/**
 * The cities Rollshot is open in, grouped by region for pickers. Each has its own time zone, so
 * "today", open days and calendar times are local to the shoot. Keep this in step with the
 * public.cities table (0022_us_cities.sql): a city must be in both.
 */
export type City = { name: string; state: string; tz: string; region: string };

const ET = "America/New_York", CT = "America/Chicago", MT = "America/Denver", PT = "America/Los_Angeles";

export const CITY_LIST: City[] = [
  { name: "Miami", state: "FL", tz: ET, region: "Florida" },
  { name: "Fort Lauderdale", state: "FL", tz: ET, region: "Florida" },
  { name: "Boca Raton", state: "FL", tz: ET, region: "Florida" },
  { name: "West Palm Beach", state: "FL", tz: ET, region: "Florida" },
  { name: "Orlando", state: "FL", tz: ET, region: "Florida" },
  { name: "Tampa", state: "FL", tz: ET, region: "Florida" },
  { name: "Jacksonville", state: "FL", tz: ET, region: "Florida" },
  { name: "New York City", state: "NY", tz: ET, region: "Northeast" },
  { name: "Buffalo", state: "NY", tz: ET, region: "Northeast" },
  { name: "Rochester", state: "NY", tz: ET, region: "Northeast" },
  { name: "Syracuse", state: "NY", tz: ET, region: "Northeast" },
  { name: "Boston", state: "MA", tz: ET, region: "Northeast" },
  { name: "Philadelphia", state: "PA", tz: ET, region: "Northeast" },
  { name: "Washington", state: "DC", tz: ET, region: "Northeast" },
  { name: "Atlanta", state: "GA", tz: ET, region: "South" },
  { name: "Charlotte", state: "NC", tz: ET, region: "South" },
  { name: "Raleigh", state: "NC", tz: ET, region: "South" },
  { name: "Nashville", state: "TN", tz: CT, region: "South" },
  { name: "Houston", state: "TX", tz: CT, region: "Texas" },
  { name: "Dallas", state: "TX", tz: CT, region: "Texas" },
  { name: "Austin", state: "TX", tz: CT, region: "Texas" },
  { name: "San Antonio", state: "TX", tz: CT, region: "Texas" },
  { name: "Chicago", state: "IL", tz: CT, region: "Midwest" },
  { name: "Detroit", state: "MI", tz: "America/Detroit", region: "Midwest" },
  { name: "Columbus", state: "OH", tz: ET, region: "Midwest" },
  { name: "Minneapolis", state: "MN", tz: CT, region: "Midwest" },
  { name: "St. Louis", state: "MO", tz: CT, region: "Midwest" },
  { name: "Kansas City", state: "MO", tz: CT, region: "Midwest" },
  { name: "Denver", state: "CO", tz: MT, region: "West" },
  { name: "Phoenix", state: "AZ", tz: "America/Phoenix", region: "West" },
  { name: "Las Vegas", state: "NV", tz: PT, region: "West" },
  { name: "Salt Lake City", state: "UT", tz: MT, region: "West" },
  { name: "Los Angeles", state: "CA", tz: PT, region: "California" },
  { name: "San Diego", state: "CA", tz: PT, region: "California" },
  { name: "San Francisco", state: "CA", tz: PT, region: "California" },
  { name: "San Jose", state: "CA", tz: PT, region: "California" },
  { name: "Sacramento", state: "CA", tz: PT, region: "California" },
  { name: "Seattle", state: "WA", tz: PT, region: "Northwest" },
  { name: "Portland", state: "OR", tz: PT, region: "Northwest" },
];

export const CITIES = CITY_LIST.map((c) => c.name);
const BY_NAME = new Map(CITY_LIST.map((c) => [c.name, c]));
export const isCity = (name: string | null | undefined): name is string => !!name && BY_NAME.has(name);
export const cityOf = (name: string | null | undefined) => (name ? BY_NAME.get(name) : undefined);
/** A city's time zone. Unknown places (old free-text crew job cities) fall back to Eastern. */
export const tzOf = (name: string | null | undefined) => cityOf(name)?.tz ?? ET;
export const cityLabel = (name: string) => {
  const c = BY_NAME.get(name);
  return c ? `${c.name}, ${c.state}` : name;
};

/** Cities grouped for a picker, in list order. */
export const CITY_GROUPS = CITY_LIST.reduce<{ region: string; cities: City[] }[]>((groups, c) => {
  const g = groups.find((x) => x.region === c.region);
  if (g) g.cities.push(c);
  else groups.push({ region: c.region, cities: [c] });
  return groups;
}, []);

/** Most a creator can work in: their home city plus 2 more. */
export const MAX_CITIES = 3;

/** "Miami, FL" or "Miami, FL · also New York City, Atlanta" for a creator's cities. */
export function citiesLabel(home: string, more: string[] | null | undefined) {
  const extra = (more ?? []).filter((c) => c && c !== home);
  return extra.length ? `${cityLabel(home)} · also ${extra.join(", ")}` : cityLabel(home);
}

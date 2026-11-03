// Sunset and golden hour for South Florida (NOAA solar equations).
const LAT = 26.7153;
const LON = -80.0534;
const rad = Math.PI / 180;

/** Sunset for a YYYY-MM-DD date at West Palm Beach, as a Date. */
export function sunset(day: string): Date {
  const d = new Date(day + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 864e5);
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(decl)) - Math.tan(LAT * rad) * Math.tan(decl)) / rad;
  const minutesUtc = 720 - 4 * (LON - ha) - eqt;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + minutesUtc * 6e4);
}

const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** "Golden hour 4:52 to 5:32 PM" style label. */
export function goldenHour(day: string) {
  const s = sunset(day);
  return `${time(new Date(s.getTime() - 40 * 6e4))} to ${time(s)}`;
}

export function prettyDate(day: string) {
  return new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Today's date in Florida as YYYY-MM-DD. */
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

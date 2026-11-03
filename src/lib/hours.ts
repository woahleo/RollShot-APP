/** Hours on an open day are stored as "16:00-20:00". No entry means any time works. */
export type Hours = Record<string, string>;

export const PRESETS = [
  { label: "Morning", range: "07:00-11:00" },
  { label: "Midday", range: "11:00-15:00" },
  { label: "Evening", range: "15:00-19:00" },
  { label: "Night", range: "19:00-23:00" },
] as const;

const RANGE_RE = /^(\d\d):(\d\d)-(\d\d):(\d\d)$/;

export function isRange(r: string | undefined | null): r is string {
  const m = r ? RANGE_RE.exec(r) : null;
  return !!m && `${m[1]}:${m[2]}` < `${m[3]}:${m[4]}`;
}

/** "16:30" or "16:30:00" -> "4:30 PM"; "16:00" -> "4 PM". */
export function prettyTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${ampm}`;
}

/** "16:00-20:00" -> "4–8 PM"; "11:00-15:00" -> "11 AM–3 PM". */
export function prettyRange(r: string) {
  const [a, b] = r.split("-");
  const pa = prettyTime(a);
  const pb = prettyTime(b);
  const sameHalf = pa.slice(-2) === pb.slice(-2);
  return `${sameHalf ? pa.slice(0, -3) : pa}–${pb}`;
}

/** Start times a car owner can pick: every 30 minutes, leaving at least an hour before the end. */
export function startTimes(r: string) {
  const [a, b] = r.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  });
  const out: string[] = [];
  for (let t = a; t <= Math.max(a, b - 60); t += 30) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

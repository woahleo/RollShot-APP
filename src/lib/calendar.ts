/** Calendar events for booked shoots and crew jobs: an .ics file (Apple, Outlook) and a Google link. */
export type CalEvent = {
  uid: string;
  title: string;
  day: string; // YYYY-MM-DD, Florida time
  time: string | null; // HH:MM[:SS], or null for an all-day event
  minutes?: number;
  details: string;
  location?: string;
  url?: string;
};

const TZ = "America/New_York";

/** A wall-clock time in Florida as a real instant, so it lands right on any phone's calendar. */
export function floridaToUtc(day: string, time: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return new Date(guess + (guess - shown));
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const compact = (day: string) => day.replace(/-/g, "");
function nextDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function span(e: CalEvent) {
  if (!e.time) return { allDay: true as const, start: compact(e.day), end: compact(nextDay(e.day)) };
  const start = floridaToUtc(e.day, e.time);
  const end = new Date(start.getTime() + (e.minutes ?? 120) * 60000);
  return { allDay: false as const, start: stamp(start), end: stamp(end) };
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Calendar file lines are at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function icsFile(e: CalEvent) {
  const s = span(e);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rollshot//Shoots//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@rollshot`,
    `DTSTAMP:${stamp(new Date())}`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details + (e.url ? `\n\n${e.url}` : ""))}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    s.allDay ? "TRIGGER:-PT6H" : "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleLink(e: CalEvent) {
  const s = span(e);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${s.start}/${s.end}`,
    details: e.details + (e.url ? `\n\n${e.url}` : ""),
    ctz: TZ,
  });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

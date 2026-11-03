// Date helpers for Florida time.

export function prettyDate(day: string) {
  return new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Today's date in Florida as YYYY-MM-DD. */
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

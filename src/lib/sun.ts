// Date helpers. Days are local to a city; Eastern is the default.

export function prettyDate(day: string) {
  return new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Today's date as YYYY-MM-DD in a time zone (Eastern unless a city's zone is given). */
export function today(tz = "America/New_York") {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** A small calendar tile: month, day number, weekday. */
export default function DateTile({ day, dim = false }: { day: string; dim?: boolean }) {
  const d = new Date(`${day}T12:00:00`);
  return (
    <span className={`datetile${dim ? " dim" : ""}`} aria-hidden="true">
      <small>{d.toLocaleDateString("en-US", { month: "short" })}</small>
      <b>{d.getDate()}</b>
      <small>{d.toLocaleDateString("en-US", { weekday: "short" })}</small>
    </span>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { photoUrl } from "@/lib/types";

export type AdminUser = {
  id: string; email: string | null; name: string | null; role: "client" | "pro" | null; handle: string | null; city: string | null;
  avatar: string | null; signed_up: string; last_seen: string | null; bookings: number; requests: number; messages: number;
};

const day = (iso: string | null) => {
  if (!iso) return "never";
  const d = new Date(iso);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(thisYear ? {} : { year: "numeric" }), timeZone: "America/New_York" });
};
const many = (n: number, word: string) => <span><b>{n}</b> {n === 1 ? word : `${word}s`}</span>;

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "client", label: "Car owners" },
  { key: "pro", label: "Creators" },
  { key: "none", label: "Didn't finish" },
] as const;

/** Every account, newest first, with a search box and a filter by account type. */
export default function AdminUsers({ users }: { users: AdminUser[] }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) =>
      (f === "all" || (f === "none" ? !u.role : u.role === f)) &&
      (!s || [u.name, u.email, u.handle, u.city].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [users, q, f]);
  const count = (k: string) => (k === "all" ? users.length : users.filter((u) => (k === "none" ? !u.role : u.role === k)).length);

  return (
    <section style={{ marginTop: 28 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Everyone</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, city" style={{ maxWidth: 280 }} aria-label="Search people" />
      </div>
      <div className="chips" style={{ margin: "12px 0 14px" }}>
        {FILTERS.map((x) => (
          <button key={x.key} type="button" className={`chip${f === x.key ? " on" : ""}`} aria-pressed={f === x.key} onClick={() => setF(x.key)}>
            {x.label} <span className="muted">{count(x.key)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">Nobody matches that.</p>
      ) : (
        <ul className="people">
          {shown.map((u) => {
            const href = u.role === "pro" ? `/p/${u.handle ?? u.id}` : u.role === "client" ? `/u/${u.id}` : null;
            const name = u.name || "No name yet";
            return (
              <li key={u.id} className="person">
                <span className="avatar sm" aria-hidden="true">
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(u.avatar)} alt="" />
                  ) : (
                    (name.trim()[0] ?? "?").toUpperCase()
                  )}
                </span>
                <div className="person-main">
                  <div className="person-top">
                    {href ? <Link href={href}><b>{name}</b></Link> : <b>{name}</b>}
                    <span className={`badge ${u.role ?? "none"}`}>{u.role === "pro" ? "Creator" : u.role === "client" ? "Car owner" : "Didn't finish"}</span>
                  </div>
                  {u.email && <a className="small person-email" href={`mailto:${u.email}`}>{u.email}</a>}
                  <span className="small muted">
                    Joined {day(u.signed_up)} · last in {day(u.last_seen)}
                    {u.city ? ` · ${u.city}` : ""}
                  </span>
                </div>
                <div className="person-stats small muted">
                  {many(u.bookings, "booking")}
                  {u.role !== "pro" && many(u.requests, "request")}
                  {many(u.messages, "message")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

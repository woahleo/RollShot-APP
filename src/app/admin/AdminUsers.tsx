"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

type FilterKey = (typeof FILTERS)[number]["key"];
const isFilter = (k: string | undefined): k is FilterKey => FILTERS.some((x) => x.key === k);
const SCROLL_KEY = "rs-admin-scroll";

/**
 * Every account, newest first, with a search box and a filter by account type. The tab and search
 * live in the address bar, so opening someone and pressing Back lands on the same tab, scrolled to
 * the same spot in the list.
 */
export default function AdminUsers({ users }: { users: AdminUser[] }) {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? undefined;
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [f, setF] = useState<FilterKey>(isFilter(tab) ? tab : "all");
  const box = useRef<HTMLDivElement>(null);

  // Keep the tab and search in the URL without reloading the page.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (f === "all") p.delete("tab"); else p.set("tab", f);
    if (q.trim()) p.set("q", q.trim()); else p.delete("q");
    const next = `${window.location.pathname}${p.size ? `?${p}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
  }, [f, q]);

  // Put the list back where it was after Back, and remember where it is as it scrolls.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null") as { f: string; top: number } | null;
      if (saved?.f === f) el.scrollTop = saved.top;
    } catch {}
    const save = () => { try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ f, top: el.scrollTop })); } catch {} };
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, [f]);
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, city" style={{ maxWidth: 280 }} aria-label="Search people" />
      </div>
      <div className="chips" style={{ margin: "12px 0 14px" }}>
        {FILTERS.map((x) => (
          <button key={x.key} type="button" className={`chip${f === x.key ? " on" : ""}`} aria-pressed={f === x.key} onClick={() => { setF(x.key); if (box.current) box.current.scrollTop = 0; }}>
            {x.label} <span className="muted">{count(x.key)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">Nobody matches that.</p>
      ) : (
        <div className="people-box" ref={box}>
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
                  {u.email && <a className="small person-email" href={u.email.startsWith("+") ? `tel:${u.email}` : `mailto:${u.email}`}>{u.email}</a>}
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
        </div>
      )}
      {shown.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Showing {shown.length} of {users.length}</p>}
    </section>
  );
}

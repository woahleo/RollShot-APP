"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { photoUrl } from "@/lib/types";

/** A round initial that opens a small menu: messages, settings, light/dark and sign out. */
export default function AccountMenu({ name, label, avatar }: { name: string; label: string; avatar?: string | null }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setDark(document.documentElement.dataset.rs === "dark"), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function flip() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.rs = next;
    try { localStorage.setItem("rs-theme", next); } catch {}
    setDark(!dark);
  }

  return (
    <div className="acct" ref={box}>
      <button type="button" className="avatar" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(avatar)} alt="" />
        ) : (
          (name.trim()[0] ?? "R").toUpperCase()
        )}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <b>{name || "Your account"}</b>
            <span>{label}</span>
          </div>
          <Link href="/messages" role="menuitem">Messages</Link>
          <Link href="/settings" role="menuitem">Settings</Link>
          <button type="button" role="menuitem" onClick={flip}>{dark ? "Light mode" : "Dark mode"}</button>
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}

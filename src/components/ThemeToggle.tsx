"use client";
import { useEffect, useState } from "react";

// The theme lives on <html data-rs>, saved per browser. Light is the default.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.rs === "dark"), []);
  function flip() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.rs = next;
    try { localStorage.setItem("rs-theme", next); } catch {}
    setDark(!dark);
  }
  return (
    <button className="btn small" onClick={flip} aria-label="Switch light or dark">
      {dark ? "Light" : "Dark"}
    </button>
  );
}

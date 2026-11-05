"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = {
  /** The page this step is on. The tour goes there first if needed. */
  path?: string;
  /** What to point at. Without one, or if it isn't on the page, the bubble sits in the middle. */
  target?: string;
  title: string;
  body: string;
};

const nav = (href: string) => `.nav a[href="${href}"]`;

function ownerSteps(first: string): Step[] {
  return [
    { title: `Welcome to Rollshot${first ? `, ${first}` : ""}`, body: "Rollshot connects you with car photographers and videographers near you. Here's a one-minute look at how it works." },
    { path: "/book", target: '[data-tour="creators"]:not(:empty), .first-city', title: "Find a creator", body: "These are creators near you. Tap one to see their work, packages and prices, and the days they're open. Then pick a day and book." },
    { path: "/book", target: '[data-tour="filters"]', title: "Narrow it down", body: "Show only photographers or videographers, and pick your city." },
    { path: "/requests", target: '[data-tour="post-request"]', title: "Or let them come to you", body: "Post your car, the date and what you want shot. Creators send offers with their price, and you pick one." },
    { path: "/shoots", target: nav("/shoots"), title: "Your shoots", body: "Everything you book shows up here, with the date and where it stands." },
    { path: "/me", target: '[data-tour="add-car"]', title: "Your garage", body: "Add your car and a few photos so creators know what they'd be shooting." },
    { target: ".bell", title: "Updates", body: "When a creator answers, sends an offer or confirms a day, it shows up here." },
    { target: ".bubble", title: "Messages", body: "Chat with a creator here once you've booked them or they've sent you an offer." },
    { target: ".acct", title: "You're all set", body: "Your settings live here. You can replay this tour from Settings any time." },
  ];
}

function creatorSteps(first: string): Step[] {
  return [
    { title: `Welcome to Rollshot${first ? `, ${first}` : ""}`, body: "Car owners come here to book photo and video shoots. Here's a one-minute look at how you get booked." },
    { path: "/pro", target: '[data-tour="stats"]', title: "Your dashboard", body: "New booking requests, upcoming shoots and what you've booked so far, all in one place." },
    { path: "/pro", target: '[data-tour="open-days"] .quick', title: "Open your days", body: "Car owners can only book you on days you open. Tap days on the calendar below, or open all your weekends in one tap." },
    { path: "/pro", target: '[data-tour="edit-profile"]', title: "Your profile", body: "Add your best photos, videos and Instagram reels, and set your packages and prices." },
    { path: "/pro", target: '[data-tour="my-page"]', title: "Your page", body: "This is what car owners see. Share the link in your Instagram bio." },
    { path: "/requests", target: nav("/requests"), title: "Requests", body: "Car owners post the shoot they want. Send an offer with your price, and they choose who shoots it." },
    { path: "/crew", target: nav("/crew"), title: "Crew", body: "Need a second shooter, or want extra work? Hire other creators or pick up their jobs here." },
    { target: ".bell", title: "Updates", body: "New bookings, offers that got picked and reminders show up here." },
    { target: ".bubble", title: "Messages", body: "Chat with car owners here to sort out the details." },
    { target: ".acct", title: "You're all set", body: "Your settings live here. You can replay this tour from Settings any time." },
  ];
}

const doneKey = (id: string) => `rs-tour-done-${id}`;

/**
 * A short first-time tour that points at the parts of the app that matter, one at a time, with a
 * different set of steps for car owners and creators. It starts on its own for new accounts, and
 * Settings can start it again by firing a "rs-tour" event.
 */
export default function Tour({ userId, role, name, auto }: { userId: string; role: "client" | "pro"; name: string; auto: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [bubbleH, setBubbleH] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const first = name.trim().split(/\s+/)[0] ?? "";
  const steps = useMemo(() => (role === "pro" ? creatorSteps(first) : ownerSteps(first)), [role, first]);
  const current = step === null ? null : steps[step];

  // Start on its own once, for a new account, but not in the middle of signing up.
  useEffect(() => {
    if (!auto || /^\/(onboarding|signup|auth)/.test(path)) return;
    try { if (localStorage.getItem(doneKey(userId))) return; } catch {}
    const t = setTimeout(() => setStep((s) => s ?? 0), 600);
    return () => clearTimeout(t);
  }, [auto, path, userId]);

  useEffect(() => {
    const replay = () => setStep(0);
    window.addEventListener("rs-tour", replay);
    return () => window.removeEventListener("rs-tour", replay);
  }, []);

  const finish = useCallback(() => {
    setStep(null);
    setRect(null);
    try { localStorage.setItem(doneKey(userId), "1"); } catch {}
    createClient().auth.updateUser({ data: { tour_done: true } }).catch(() => {});
  }, [userId]);

  // Go to the step's page if needed, then follow its target as the page scrolls or moves.
  useEffect(() => {
    if (!current) return;
    if (current.path && path !== current.path) {
      setRect(null);
      router.push(current.path);
      return;
    }
    let raf = 0;
    let scrolled = false;
    const started = performance.now();
    const tick = () => {
      setView((v) => (v.w === innerWidth && v.h === innerHeight ? v : { w: innerWidth, h: innerHeight }));
      const el = current.target ? document.querySelector<HTMLElement>(current.target) : null;
      if (el && el.getClientRects().length) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }
        const r = el.getBoundingClientRect();
        setRect((old) => (old && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r));
      } else if (!current.target || performance.now() - started > 2500) {
        setRect(null); // nothing to point at: the bubble sits in the middle
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [current, path, router]);

  // The bubble's height decides whether it fits below the target.
  const open = step !== null;
  useEffect(() => {
    const el = bubble.current;
    if (!open || !el) return;
    const ro = new ResizeObserver(() => setBubbleH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (step === null) return;
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setStep((s) => (s === null ? s : Math.min(steps.length - 1, s + 1)));
      if (e.key === "ArrowLeft") setStep((s) => (s === null ? s : Math.max(0, s - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, steps.length, finish]);

  if (step === null || !current) return null;
  const last = step === steps.length - 1;
  const waiting = current.path && path !== current.path;

  // Place the bubble below the target, or above it when there's more room there.
  const pad = 8;
  const width = Math.min(340, view.w - 32);
  let style: React.CSSProperties;
  let arrow: React.CSSProperties | null = null;
  let hole: React.CSSProperties | null = null;
  if (rect && !waiting) {
    hole = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
    const below = rect.bottom + pad + 14 + bubbleH < view.h - 12 || rect.top < view.h - rect.bottom;
    const cx = rect.left + rect.width / 2;
    const left = Math.max(16, Math.min(view.w - 16 - width, cx - width / 2));
    const top = below ? rect.bottom + pad + 14 : rect.top - pad - 14 - bubbleH;
    style = { left, top: Math.max(12, Math.min(view.h - bubbleH - 12, top)), width };
    arrow = { left: Math.max(18, Math.min(width - 18, cx - left)), [below ? "top" : "bottom"]: -7 };
  } else {
    style = { left: (view.w - width) / 2, top: Math.max(12, (view.h - bubbleH) / 2), width };
  }

  return (
    <div className="tour" aria-live="polite">
      <div className="tour-shade" onClick={(e) => e.stopPropagation()} />
      {hole ? <div className="tour-hole" style={hole} /> : <div className="tour-dim" />}
      <div ref={bubble} className="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ ...style, visibility: waiting || !view.w ? "hidden" : undefined }}>
        {arrow && <i className="tour-arrow" style={arrow} />}
        <p className="tour-count">{step + 1} of {steps.length}</p>
        <h3 id="tour-title">{current.title}</h3>
        <p>{current.body}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={finish}>Skip tour</button>}
          <span style={{ flex: 1 }} />
          {step > 0 && <button type="button" className="btn small" onClick={() => setStep(step - 1)}>Back</button>}
          <button
            ref={primary}
            type="button"
            className="btn solid small"
            onClick={() => {
              if (!last) return setStep(step + 1);
              finish();
              router.push(role === "pro" ? "/pro/edit" : "/book");
            }}
          >
            {last ? (role === "pro" ? "Finish my profile" : "Find a creator") : step === 0 ? "Show me around" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

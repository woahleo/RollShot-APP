"use client";
import { useEffect, useRef, useState } from "react";

/** Instagram's player needs about 326px of width, so it's drawn at this width and scaled to fit the tile. */
const W = 360;
/** The player's own width in the page (see .reel iframe), the width it's briefly widened to, and its name bar. */
const FRAME = 362;
const PROBE = 480;
const TOP = 55;
const IG = "https://www.instagram.com";

/** How tall the video is for its width (16:9 is 0.5625, 9:16 is 1.78), and the player's full height. */
type Shape = { ratio: number; height: number };
const clampRatio = (r: number) => Math.min(16 / 9, Math.max(9 / 16, r));

/**
 * A creator's chosen Instagram reels, as plain videos. Each one is Instagram's own player (the only way
 * to play a reel without the creator logging in), framed so only the video shows: the name bar above it
 * and the likes and comments below it are cut off. Tap to play, right on the page.
 *
 * Reels come in every shape, and the player doesn't say which. But it does report its own height to the
 * page ("MEASURE" messages), and that height grows with its width only through the video. So each player
 * is measured at two widths: the difference gives the video's shape, and the tile takes that shape.
 * Tall reels sit two across, wide ones take a whole row. Until a player reports, its tile stays wide.
 *
 * Instagram's player answers a second tap with a "Watch on Instagram" screen that sends people to the
 * app. So once a reel is tapped, a clear layer goes over it, and tapping that stops the reel here
 * (the player reloads to its cover) instead.
 */
export default function Reels({ links }: { links: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState<string[]>([]);
  const [resets, setResets] = useState<Record<string, number>>({});
  const [shapes, setShapes] = useState<Record<string, Shape>>({});
  // Per reel: the player's height at its normal width, and whether it's being measured wider right now.
  const probes = useRef<Record<string, { base: number; done: boolean }>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Players load after the page wakes up, so their first height report isn't missed.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    const t = timers.current;
    const settle = (link: string, frame: HTMLIFrameElement, wider?: number) => {
      const pr = probes.current[link];
      if (!pr || pr.done) return;
      pr.done = true;
      clearTimeout(t[link]);
      frame.style.width = "";
      // With a second height, the difference is all video. Without one, guess, leaving room for the likes below.
      const ratio = wider !== undefined ? (wider - pr.base) / (PROBE - FRAME) : (pr.base - TOP - 250) / FRAME;
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      setShapes((m) => ({ ...m, [link]: { ratio: clampRatio(ratio), height: pr.base } }));
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== IG) return;
      let d: unknown = e.data;
      if (typeof d === "string") {
        if (d[0] !== "{") return;
        try { d = JSON.parse(d); } catch { return; }
      }
      const msg = d as { type?: string; details?: { height?: unknown } } | null;
      const h = Number(msg?.details?.height);
      if (msg?.type !== "MEASURE" || !(h > 0)) return;
      const frame = Array.from(box.current?.querySelectorAll("iframe") ?? []).find((f) => f.contentWindow === e.source);
      const link = frame?.dataset.link;
      if (!frame || !link) return;
      const pr = probes.current[link];
      if (!pr) {
        // First report, at the normal width. Widen the player for a moment and wait for it to report again.
        probes.current[link] = { base: h, done: false };
        frame.style.width = `${PROBE}px`;
        t[link] = setTimeout(() => settle(link, frame), 2500);
      } else if (!pr.done && h !== pr.base) {
        settle(link, frame, h);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.querySelectorAll<HTMLElement>(".reel").forEach((t) => t.style.setProperty("--s", String(t.clientWidth / W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // Tiles change width when a reel turns out to be tall, so watch each one too.
    el.querySelectorAll(".reel").forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [links.length]);

  // A tap inside a player moves focus into its frame. Watch for that, and for moves from one player to another.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = () => {
      const f = document.activeElement;
      const link = f instanceof HTMLIFrameElement && box.current?.contains(f) ? f.dataset.link : undefined;
      if (link) setPlaying((p) => (p.includes(link) ? p : [...p, link]));
    };
    const onBlur = () => {
      setTimeout(check, 0);
      clearInterval(timer);
      timer = setInterval(check, 300);
    };
    const onFocus = () => clearInterval(timer);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  function stop(link: string) {
    setPlaying((p) => p.filter((l) => l !== link));
    setResets((r) => ({ ...r, [link]: (r[link] ?? 0) + 1 }));
  }

  if (!links.length) return null;
  return (
    <div className="reels" ref={box}>
      {links.map((l, i) => {
        const sh = shapes[l];
        const tall = !!sh && sh.ratio > 1;
        return (
        <div
          key={l}
          className={`reel${tall ? "" : " wide"}`}
          style={sh && Math.abs(sh.ratio - 9 / 16) > 0.02 ? { aspectRatio: `1 / ${sh.ratio}` } : undefined}
        >
          <iframe
            key={resets[l] ?? 0}
            data-link={l}
            src={ready ? `${l}embed/` : undefined}
            style={sh ? { height: Math.max(600, Math.ceil(sh.height) + 40) } : undefined}
            title={`Video ${i + 1}`}
            loading={i < 2 ? "eager" : "lazy"}
            scrolling="no"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {playing.includes(l) && (
            <button type="button" className="reel-stop" onClick={() => stop(l)} aria-label={`Stop video ${i + 1}`}>
              <span aria-hidden="true">Tap to stop</span>
            </button>
          )}
        </div>
        );
      })}
    </div>
  );
}

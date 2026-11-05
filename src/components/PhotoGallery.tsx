"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Width divided by height below which a photo counts as tall (portrait). */
const TALL = 0.9;

/**
 * A photo grid where tapping a photo opens it full screen. A tall first photo keeps its shape instead
 * of being cropped wide, and when most photos are tall the small tiles are tall too. From there you swipe (or use the arrow
 * keys) through the rest. Close with the X, Escape, or the phone's back gesture.
 */
export default function PhotoGallery({ photos, alt, className = "gallery feature", style }: {
  photos: string[]; alt: string; className?: string; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  // Each photo's width / height, once it has loaded.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const measure = useCallback((img: HTMLImageElement) => {
    const src = img.dataset.src;
    if (!src || !img.naturalWidth || !img.naturalHeight) return;
    const r = img.naturalWidth / img.naturalHeight;
    setRatios((prev) => (prev[src] === r ? prev : { ...prev, [src]: r }));
  }, []);
  // Photos that finished loading before the page came alive don't fire onLoad again.
  useEffect(() => {
    grid.current?.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => { if (img.complete) measure(img); });
  }, [photos, measure]);
  const known = photos.filter((src) => ratios[src]);
  const mostlyTall = known.length > 0 && known.filter((src) => ratios[src] < TALL).length * 2 > known.length;

  const show = (i: number) => {
    setIndex(i);
    setOpen(i);
    // So the phone's back gesture closes the viewer instead of leaving the page.
    try { history.pushState({ ...(history.state ?? {}), viewer: true }, ""); } catch {}
  };
  const close = useCallback(() => {
    if (history.state?.viewer) history.back();
    else setOpen(null);
  }, []);
  const go = useCallback((step: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth) + step));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [photos.length]);

  // Jump straight to the photo that was tapped.
  useLayoutEffect(() => {
    if (open === null || !track.current) return;
    track.current.scrollLeft = open * track.current.clientWidth;
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onPop = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, go]);

  const leadRatio = ratios[photos[0]];
  const leadTall = leadRatio !== undefined && leadRatio < TALL;
  const split = leadTall && photos.length > 1 && className.split(" ").includes("feature");

  const tile = (src: string, i: number, extra = "") => {
    const r = ratios[src];
    const tall = r !== undefined && r < TALL;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        data-src={src}
        alt={alt}
        loading="lazy"
        role="button"
        tabIndex={0}
        className={["zoomable", tall && "tall", extra].filter(Boolean).join(" ")}
        style={tall && i === 0 ? ({ "--r": Math.max(r, 9 / 16) } as React.CSSProperties) : undefined}
        onLoad={(e) => measure(e.currentTarget)}
        onClick={() => show(i)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i); } }}
      />
    );
  };

  return (
    <>
      {split ? (
        // A tall lead photo sits above the rest on a phone and beside them on a wider screen.
        <div className="gallery-split" style={style} ref={grid}>
          {tile(photos[0], 0, "lead")}
          <div className={`gallery split-rest${mostlyTall ? " tall-tiles" : ""}`}>
            {photos.slice(1).map((src, i) => tile(src, i + 1))}
          </div>
        </div>
      ) : (
        <div className={`${className}${mostlyTall ? " tall-tiles" : ""}`} style={style} ref={grid}>
          {photos.map((src, i) => tile(src, i))}
        </div>
      )}

      {open !== null && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Photos">
          <div className="viewer-bar">
            <span>{index + 1} / {photos.length}</span>
            <button type="button" className="viewer-close" onClick={close} aria-label="Close">✕</button>
          </div>
          <div
            className="viewer-track"
            ref={track}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {photos.map((src, i) => (
              <div key={src} className="viewer-slide" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${alt} (${i + 1} of ${photos.length})`} loading={Math.abs(i - open) <= 1 ? "eager" : "lazy"} decoding="async" />
              </div>
            ))}
          </div>
          {photos.length > 1 && (
            <>
              <button type="button" className="viewer-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo">‹</button>
              <button type="button" className="viewer-nav next" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Next photo">›</button>
              <div className="viewer-dots" aria-hidden="true">
                {photos.length <= 20 && photos.map((src, i) => <i key={src} className={i === index ? "on" : ""} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

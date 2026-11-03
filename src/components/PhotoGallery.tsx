"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A photo grid where tapping a photo opens it full screen. From there you swipe (or use the arrow
 * keys) through the rest. Close with the X, Escape, or the phone's back gesture.
 */
export default function PhotoGallery({ photos, alt, className = "gallery feature", style }: {
  photos: string[]; alt: string; className?: string; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <div className={className} style={style}>
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={alt}
            loading="lazy"
            role="button"
            tabIndex={0}
            className="zoomable"
            onClick={() => show(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i); } }}
          />
        ))}
      </div>

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

"use client";
import { useEffect, useRef, useState } from "react";
import { posterOf } from "@/lib/reels";
import { photoUrl } from "@/lib/types";

/**
 * A creator's uploaded videos as plain tiles. Vertical videos are tall tiles, two or three across; wide or
 * square ones take a whole row at their own shape, so nothing gets cropped off. Each plays muted and on a
 * loop while it's on screen (like a reel) and pauses when scrolled away. Tap one for sound, tap again to mute.
 */
export default function Videos({ paths, name }: { paths: string[]; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [loud, setLoud] = useState<string | null>(null);
  // Width / height of each video once the browser knows it.
  const [shape, setShape] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !reduce) v.play().catch(() => {});
        else v.pause();
      }
    }, { threshold: 0.6 });
    el.querySelectorAll("video").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [paths]);

  if (!paths.length) return null;
  return (
    <div className="vids" ref={box}>
      {paths.map((p, i) => {
        const r = shape[p];
        const wide = r !== undefined && r >= 0.9;
        return (
        <div key={p} className={`vid${wide ? " wide" : ""}`} style={wide ? { aspectRatio: String(r) } : undefined}>
          <video
            src={photoUrl(p)}
            poster={photoUrl(posterOf(p))}
            muted={loud !== p}
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setShape((m) => ({ ...m, [p]: v.videoWidth / v.videoHeight }));
            }}
            aria-label={`Video ${i + 1} by ${name}`}
            onClick={(e) => {
              const v = e.currentTarget;
              setLoud(loud === p ? null : p);
              v.play().catch(() => {});
            }}
          />
          <span className="vid-sound" aria-hidden="true">{loud === p ? "Sound on" : "Tap for sound"}</span>
        </div>
        );
      })}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { posterOf } from "@/lib/reels";
import { photoUrl } from "@/lib/types";

/**
 * A creator's uploaded videos as plain, tall tiles. Each plays muted and on a loop while it's on screen
 * (like a reel) and pauses when scrolled away. Tap one for sound, tap again to mute.
 */
export default function Videos({ paths, name }: { paths: string[]; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [loud, setLoud] = useState<string | null>(null);

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
      {paths.map((p, i) => (
        <div key={p} className="vid">
          <video
            src={photoUrl(p)}
            poster={photoUrl(posterOf(p))}
            muted={loud !== p}
            loop
            playsInline
            preload="metadata"
            aria-label={`Video ${i + 1} by ${name}`}
            onClick={(e) => {
              const v = e.currentTarget;
              setLoud(loud === p ? null : p);
              v.play().catch(() => {});
            }}
          />
          <span className="vid-sound" aria-hidden="true">{loud === p ? "Sound on" : "Tap for sound"}</span>
        </div>
      ))}
    </div>
  );
}

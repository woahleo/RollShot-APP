"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type Slide = { src: string; name: string; city: string; href: string };

const EVERY_MS = 5000;

/**
 * The big home page photo: creators' photos in a random order, fading to the next one every few
 * seconds. Pauses while the tab is hidden. With reduced motion on, it still changes but without the fade.
 */
export default function HeroSlides({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const n = slides.length;

  useEffect(() => {
    if (n < 2) return;
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!t) t = setInterval(() => setI((x) => (x + 1) % n), EVERY_MS); };
    const stop = () => { if (t) clearInterval(t); t = null; };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [n]);

  // Load the next photo ahead of time so the fade never shows a half-loaded image.
  useEffect(() => {
    if (n < 2) return;
    const img = new Image();
    img.src = slides[(i + 1) % n].src;
  }, [i, n, slides]);

  if (!n) return null;
  const cur = slides[i];
  return (
    <>
      {slides.map((s, k) =>
        // Only the previous, current and next photos are in the page. The new photo fades in over
        // the previous one, so it's a crossfade instead of a fade through black.
        k === i || k === (i + 1) % n || (n > 2 && k === (i - 1 + n) % n) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            className="vf-photo vf-slide"
            data-on={k === i || undefined}
            data-prev={(k !== i && k === (i - 1 + n) % n) || undefined}
            src={s.src}
            alt={k === i ? `Car shot by ${s.name}` : ""}
            aria-hidden={k !== i || undefined}
            fetchPriority={k === 0 ? "high" : "low"}
          />
        ) : null,
      )}
      <figcaption>
        <Link href={cur.href}>Shot by {cur.name} · {cur.city}</Link>
      </figcaption>
    </>
  );
}

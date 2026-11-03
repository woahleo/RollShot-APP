"use client";
import { useEffect, useRef } from "react";

/** Instagram's player needs about 326px of width, so it's drawn at this width and scaled to fit the tile. */
const W = 360;

/**
 * A creator's chosen Instagram reels, as plain videos. Each one is Instagram's own player (the only way
 * to play a reel without the creator logging in), framed so only the video shows: the name bar above it
 * and the likes and comments below it are cut off. Tap to play, right on the page.
 */
export default function Reels({ links }: { links: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.querySelectorAll<HTMLElement>(".reel").forEach((t) => t.style.setProperty("--s", String(t.clientWidth / W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [links.length]);

  if (!links.length) return null;
  return (
    <div className="reels" ref={box}>
      {links.map((l, i) => (
        <div key={l} className="reel">
          <iframe
            src={`${l}embed/`}
            title={`Video ${i + 1}`}
            loading={i < 2 ? "eager" : "lazy"}
            scrolling="no"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ))}
    </div>
  );
}

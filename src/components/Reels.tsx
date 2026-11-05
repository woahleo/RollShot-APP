"use client";
import { useEffect, useRef, useState } from "react";

/** Instagram's player needs about 326px of width, so it's drawn at this width and scaled to fit the tile. */
const W = 360;

/**
 * A creator's chosen Instagram reels, as plain videos. Each one is Instagram's own player (the only way
 * to play a reel without the creator logging in), framed so only the video shows: the name bar above it
 * and the likes and comments below it are cut off. Tap to play, right on the page.
 *
 * Instagram's player answers a second tap with a "Watch on Instagram" screen that sends people to the
 * app. So once a reel is tapped, a clear layer goes over it, and tapping that stops the reel here
 * (the player reloads to its cover) instead.
 */
export default function Reels({ links }: { links: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState<string[]>([]);
  const [resets, setResets] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.querySelectorAll<HTMLElement>(".reel").forEach((t) => t.style.setProperty("--s", String(t.clientWidth / W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
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
      {links.map((l, i) => (
        <div key={l} className="reel">
          <iframe
            key={resets[l] ?? 0}
            data-link={l}
            src={`${l}embed/`}
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
      ))}
    </div>
  );
}

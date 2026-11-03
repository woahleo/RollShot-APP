"use client";
import { useEffect } from "react";

declare global {
  interface Window { instgrm?: { Embeds: { process: () => void } } }
}

const SCRIPT = "https://www.instagram.com/embed.js";

/**
 * A creator's chosen Instagram reels, played in Instagram's own embed. Instagram's script swaps each
 * placeholder for the player and sizes it. If Instagram is blocked, each one stays a plain link.
 */
export default function Reels({ links }: { links: string[] }) {
  useEffect(() => {
    if (!links.length) return;
    if (window.instgrm) return window.instgrm.Embeds.process();
    if (document.querySelector(`script[src="${SCRIPT}"]`)) return;
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    document.body.appendChild(s);
  }, [links]);

  if (!links.length) return null;
  return (
    <div className="reels">
      {links.map((l) => (
        <div key={l} className="reel">
          <blockquote className="instagram-media" data-instgrm-permalink={`${l}?utm_source=ig_embed`} data-instgrm-version="14">
            <a href={l} target="_blank" rel="noreferrer">Watch on Instagram</a>
          </blockquote>
        </div>
      ))}
    </div>
  );
}

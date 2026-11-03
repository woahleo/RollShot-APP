"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_REELS, cleanReelLink } from "@/lib/reels";

/** Up to 6 Instagram reels for the creator's page: paste a link, move them around, remove them. */
export default function ReelPicker({ userId, reels: initial, pageHref }: { userId: string; reels: string[]; pageHref?: string }) {
  const router = useRouter();
  const [reels, setReels] = useState(initial);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string[]) {
    setBusy(true);
    setError("");
    const { error } = await createClient().from("pros").update({ reels: next, updated_at: new Date().toISOString() }).eq("id", userId);
    setBusy(false);
    if (error) return setError(error.message.includes("pros_reels_valid") ? "That link didn't save. Try copying it again from Instagram." : error.message);
    setReels(next);
    router.refresh();
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanReelLink(link);
    if (!clean) return setError("Paste a link to a reel or post, like instagram.com/reel/…");
    if (reels.includes(clean)) return setError("That one is already on your page.");
    if (reels.length >= MAX_REELS) return setError(`Up to ${MAX_REELS} videos. Remove one to add another.`);
    setLink("");
    save([...reels, clean]);
  }

  const move = (i: number, step: number) => {
    const next = [...reels];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    save(next);
  };

  return (
    <div className="card portfolio" id="videos">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Your videos {reels.length > 0 && <span className="muted small">· {reels.length} of {MAX_REELS}</span>}</h3>
      </div>
      <p className="small muted" style={{ margin: "6px 0 14px" }}>
        Pick up to {MAX_REELS} reels from your Instagram to play on your page. In Instagram, tap Share on a reel, then Copy link, and paste it here.
        {pageHref && reels.length > 0 && <> <Link href={pageHref}>See them on your page</Link>.</>}
      </p>
      {reels.length < MAX_REELS && (
        <form className="row reel-add" onSubmit={add}>
          <input
            value={link}
            onChange={(e) => { setLink(e.target.value); setError(""); }}
            placeholder="https://www.instagram.com/reel/…"
            inputMode="url"
            aria-label="Instagram reel link"
          />
          <button className="btn solid small" disabled={busy || !link.trim()}>Add</button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
      {reels.length > 0 && (
        <ol className="reel-list">
          {reels.map((r, i) => (
            <li key={r}>
              <a href={r} target="_blank" rel="noreferrer" className="small">{r.replace("https://www.instagram.com/", "instagram.com/")}</a>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn small" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button type="button" className="btn small" disabled={busy || i === reels.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button type="button" className="btn small" disabled={busy} onClick={() => save(reels.filter((x) => x !== r))}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

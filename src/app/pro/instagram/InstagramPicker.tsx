"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_REELS, cleanReelLink } from "@/lib/reels";

type Item = { id: string; type: "photo" | "video" | "album"; thumb: string | null; permalink: string; caption: string; photos: number; hasVideo: boolean };
const MAX_IMPORT = 12;

/** The creator's Instagram posts: tap videos to show them on their page, tap photos to copy them into the portfolio. */
export default function InstagramPicker({ userId, username, reels: initial, pageHref }: { userId: string; username: string | null; reels: string[]; pageHref: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"videos" | "photos">("videos");
  const [items, setItems] = useState<Item[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [reels, setReels] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/instagram/media${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`);
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setExpired(!!body.expired);
      return setError(body.error ?? "Couldn't load your posts.");
    }
    setItems((prev) => (cursor ? [...prev, ...body.items] : body.items));
    setAfter(body.after ?? null);
  }, []);
  useEffect(() => { load(null); }, [load]);

  const shown = items.filter((m) => (tab === "videos" ? m.type === "video" : m.photos > 0));
  const dirty = reels.join() !== saved.join();

  function toggleVideo(m: Item) {
    const link = cleanReelLink(m.permalink);
    if (!link) return setMsg("That post can't be shown on Rollshot.");
    setMsg("");
    if (reels.includes(link)) return setReels(reels.filter((r) => r !== link));
    if (reels.length >= MAX_REELS) return setMsg(`Up to ${MAX_REELS} videos. Tap one you picked to take it off first.`);
    setReels([...reels, link]);
  }
  function togglePhoto(m: Item) {
    setMsg("");
    if (picked.includes(m.id)) return setPicked(picked.filter((x) => x !== m.id));
    if (picked.length >= MAX_IMPORT) return setMsg(`Up to ${MAX_IMPORT} posts at a time.`);
    setPicked([...picked, m.id]);
  }

  async function saveVideos() {
    setBusy(true);
    const { error } = await createClient().from("pros").update({ reels, updated_at: new Date().toISOString() }).eq("id", userId);
    setBusy(false);
    if (error) return setMsg(error.message);
    setSaved(reels);
    setMsg(reels.length ? `Saved. ${reels.length} video${reels.length === 1 ? "" : "s"} on your page.` : "Saved. No videos on your page.");
    router.refresh();
  }
  async function importPhotos() {
    setBusy(true);
    setMsg(`Copying photos from ${picked.length} post${picked.length === 1 ? "" : "s"}…`);
    const res = await fetch("/api/instagram/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: picked }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(body.error ?? "Import failed.");
    setPicked([]);
    if (!body.added && !body.failed) setMsg("Those photos are already in your portfolio.");
    else setMsg(`Added ${body.added} photo${body.added === 1 ? "" : "s"} to your portfolio${body.failed ? ` (${body.failed} couldn't be copied)` : ""}.`);
    router.refresh();
  }
  async function disconnect() {
    setBusy(true);
    await fetch("/api/instagram/disconnect", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="ig-picker">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="small">Connected{username ? <> as <b style={{ fontWeight: 400 }}>@{username}</b></> : ""}</span>
        <button type="button" className="link small" disabled={busy} onClick={disconnect}>Disconnect</button>
      </div>
      <div className="seg ig-tabs">
        <button type="button" aria-pressed={tab === "videos"} onClick={() => { setTab("videos"); setMsg(""); }}>Videos · {reels.length} of {MAX_REELS}</button>
        <button type="button" aria-pressed={tab === "photos"} onClick={() => { setTab("photos"); setMsg(""); }}>Photos</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {tab === "videos"
          ? `Tap up to ${MAX_REELS} videos to play on your page, in the order you tap them. You can reorder or remove them later under Your videos on your dashboard.`
          : `Tap posts to copy their photos into your portfolio, up to ${MAX_IMPORT} at a time. Carousels bring every photo.`}
      </p>

      {error ? (
        <p className="notice">{error} {expired && <a href="/api/instagram/connect">Connect again</a>}</p>
      ) : (
        <div className="ig-grid">
          {shown.map((m) => {
            const link = cleanReelLink(m.permalink);
            const n = tab === "videos" ? (link ? reels.indexOf(link) + 1 : 0) : picked.indexOf(m.id) + 1;
            return (
              <button type="button" key={m.id} className="ig-item" aria-pressed={n > 0} onClick={() => (tab === "videos" ? toggleVideo(m) : togglePhoto(m))} title={m.caption}>
                {m.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumb} alt={m.caption || "Instagram post"} loading="lazy" referrerPolicy="no-referrer" />
                ) : <span className="ig-blank">No preview</span>}
                {tab === "photos" && m.photos > 1 && <span className="ig-count">{m.photos}</span>}
                {tab === "videos" && <span className="ig-play" aria-hidden="true">▶</span>}
                {n > 0 && <span className="ig-pick">{n}</span>}
              </button>
            );
          })}
          {!loading && shown.length === 0 && (
            <p className="muted small" style={{ gridColumn: "1 / -1" }}>
              {tab === "videos" ? "No videos in these posts." : "No photos in these posts."}{after ? " Load more to look further back." : ""}
            </p>
          )}
        </div>
      )}
      {loading && <p className="small muted">Loading your posts…</p>}
      {!loading && after && !error && <button type="button" className="btn small" style={{ justifySelf: "center" }} onClick={() => load(after)}>Load more</button>}

      <div className="ig-bar">
        <span className="small muted">{msg || (tab === "videos" ? <Link href={pageHref}>See your page</Link> : `${picked.length} picked`)}</span>
        {tab === "videos" ? (
          <button type="button" className="btn solid small" disabled={busy || !dirty} onClick={saveVideos}>Save videos</button>
        ) : (
          <button type="button" className="btn solid small" disabled={busy || picked.length === 0} onClick={importPhotos}>
            {busy ? "Copying…" : `Add to portfolio${picked.length ? ` (${picked.length})` : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}

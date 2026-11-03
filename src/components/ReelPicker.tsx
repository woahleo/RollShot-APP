"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { videoCover } from "@/lib/photos";
import { MAX_REELS, MAX_VIDEO_MB, cleanReelLink, posterOf } from "@/lib/reels";
import { photoUrl } from "@/lib/types";

type Props = { userId: string; reels: string[]; videos?: string[]; pageHref?: string; instagram?: boolean };

/**
 * Up to 6 videos for the creator's page: upload them from the phone (they play as plain video), or paste
 * an Instagram reel link. Reorder and remove either kind.
 */
export default function ReelPicker({ userId, reels: initialReels, videos: initialVideos = [], pageHref, instagram = false }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [videos, setVideos] = useState(initialVideos);
  const [reels, setReels] = useState(initialReels);
  const latest = useRef({ videos: initialVideos, reels: initialReels });
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const total = videos.length + reels.length;
  const full = total >= MAX_REELS;

  async function save(next: { videos?: string[]; reels?: string[] }) {
    const v = next.videos ?? latest.current.videos;
    const r = next.reels ?? latest.current.reels;
    setBusy(true);
    setError("");
    // Only send what changed, so links keep working even before the videos column exists.
    const patch = { ...(next.videos ? { videos: v } : {}), ...(next.reels ? { reels: r } : {}), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("pros").update(patch).eq("id", userId);
    setBusy(false);
    if (error) {
      setError(error.message.includes("_valid") ? `Up to ${MAX_REELS} videos in all. Remove one to add another.` : error.message);
      return false;
    }
    latest.current = { videos: v, reels: r };
    setVideos(v);
    setReels(r);
    router.refresh();
    return true;
  }

  function addLink(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanReelLink(link);
    if (!clean) return setError("Paste a link to a reel or post, like instagram.com/reel/…");
    if (reels.includes(clean)) return setError("That one is already on your page.");
    if (full) return setError(`Up to ${MAX_REELS} videos in all. Remove one to add another.`);
    setLink("");
    save({ reels: [...reels, clean] });
  }

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError("");
    if (full) return setError(`Up to ${MAX_REELS} videos in all. Remove one to add another.`);
    if (!f.type.startsWith("video/")) return setError("That file isn't a video.");
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      return setError(`That video is ${Math.round(f.size / 1048576)} MB. Videos can be up to ${MAX_VIDEO_MB} MB, so trim it or export it at 1080p.`);
    }
    setUploading("Getting it ready…");
    try {
      const { blob } = await videoCover(f);
      const ext = (f.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
      const path = `${userId}/vid-${crypto.randomUUID().slice(0, 12)}.${ext}`;
      setUploading(`Uploading ${Math.round(f.size / 1048576)} MB…`);
      const up = await supabase.storage.from("portfolio").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
      if (up.error) throw up.error;
      await supabase.storage.from("portfolio").upload(posterOf(path), blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (!(await save({ videos: [...latest.current.videos, path] }))) {
        await supabase.storage.from("portfolio").remove([path, posterOf(path)]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(/maximum allowed size|too large|413/i.test(msg) ? `That video is too big. Videos can be up to ${MAX_VIDEO_MB} MB.` : msg);
    }
    setUploading("");
  }

  async function removeVideo(path: string) {
    if (await save({ videos: latest.current.videos.filter((v) => v !== path) })) {
      await supabase.storage.from("portfolio").remove([path, posterOf(path)]);
    }
  }

  const swap = <T,>(list: T[], i: number, step: number) => {
    const next = [...list];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    return next;
  };

  return (
    <div className="card portfolio" id="videos">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Your videos {total > 0 && <span className="muted small">· {total} of {MAX_REELS}</span>}</h3>
        {!full && (
          <label className="btn solid small" style={{ cursor: uploading ? "progress" : "pointer" }}>
            {uploading || "Upload video"}
            <input type="file" accept="video/*" hidden disabled={!!uploading || busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <p className="small muted" style={{ margin: "6px 0 14px" }}>
        Up to {MAX_REELS} videos for your page. Uploaded videos play right on the page as tall, plain video with nothing around them (up to {MAX_VIDEO_MB} MB each).
        You can also paste an Instagram reel link{instagram ? <>, or <Link href="/pro/instagram">pick from Instagram</Link></> : ""}.
        {pageHref && total > 0 && <> <Link href={pageHref}>See them on your page</Link>.</>}
      </p>

      {videos.length > 0 && (
        <div className="vid-strip">
          {videos.map((v, i) => (
            <div key={v} className="vid-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(posterOf(v))} alt="" loading="lazy" />
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn small" disabled={busy || i === 0} onClick={() => save({ videos: swap(videos, i, -1) })} aria-label="Move left">←</button>
                <button type="button" className="btn small" disabled={busy || i === videos.length - 1} onClick={() => save({ videos: swap(videos, i, 1) })} aria-label="Move right">→</button>
                <button type="button" className="btn small" disabled={busy} onClick={() => removeVideo(v)} aria-label="Remove video">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!full && (
        <form className="row reel-add" onSubmit={addLink}>
          <input
            value={link}
            onChange={(e) => { setLink(e.target.value); setError(""); }}
            placeholder="Or paste an Instagram reel link"
            inputMode="url"
            aria-label="Instagram reel link"
          />
          <button className="btn small" disabled={busy || !link.trim()}>Add</button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
      {reels.length > 0 && (
        <ol className="reel-list">
          {reels.map((r, i) => (
            <li key={r}>
              <a href={r} target="_blank" rel="noreferrer" className="small">{r.replace("https://www.instagram.com/", "instagram.com/")}</a>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn small" disabled={busy || i === 0} onClick={() => save({ reels: swap(reels, i, -1) })} aria-label="Move up">↑</button>
                <button type="button" className="btn small" disabled={busy || i === reels.length - 1} onClick={() => save({ reels: swap(reels, i, 1) })} aria-label="Move down">↓</button>
                <button type="button" className="btn small" disabled={busy} onClick={() => save({ reels: reels.filter((x) => x !== r) })}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

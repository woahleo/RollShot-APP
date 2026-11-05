"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compress, photoExt } from "@/lib/photos";
import { photoUrl, type ShootPost } from "@/lib/types";

const MAX = 12;

/** The creator picks the photos from a finished shoot and posts them. */
export default function PostShoot({ userId, bookingId, post }: { userId: string; bookingId: string; post: ShootPost | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState<string[]>(post?.photos ?? []);
  const [video, setVideo] = useState(post?.video_url ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX - photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (list.length === 0) return setError(`Up to ${MAX} photos.`);
    setUploading(list.length);
    const added: string[] = [];
    for (const f of list) {
      try {
        const blob = await compress(f);
        const path = `${userId}/${crypto.randomUUID()}.${photoExt(blob)}`;
        const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        added.push(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading((n) => n - 1);
    }
    setPhotos((p) => [...p, ...added]);
  }

  async function save() {
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("post_shoot", {
      p_booking: bookingId,
      p_photos: photos,
      p_video_url: video,
      p_caption: caption,
    });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    router.push(`/shot/${data}`);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <h3>Photos</h3>
        <p className="small muted" style={{ marginTop: 0 }}>Up to {MAX}. They&apos;re resized on your phone first, so they load fast. The first one is the cover.</p>
        {photos.length > 0 && (
          <div className="gallery" style={{ marginBottom: 12 }}>
            {photos.map((ph, i) => (
              <div key={ph} className="shot-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(ph)} alt="" />
                <div className="row" style={{ gap: 6 }}>
                  {i > 0 && <button type="button" className="btn small" onClick={() => setPhotos([ph, ...photos.filter((p) => p !== ph)])}>Cover</button>}
                  <button type="button" className="btn small" onClick={() => setPhotos(photos.filter((p) => p !== ph))}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="btn" style={{ cursor: "pointer" }}>
          {uploading ? `Uploading ${uploading}…` : photos.length ? "Add more" : "Add photos"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </label>
      </div>

      <label className="field">
        <span>Link to the video (optional)</span>
        <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://instagram.com/reel/…" inputMode="url" />
        <span className="small muted">Instagram, TikTok, YouTube or Vimeo. The video stays where you posted it.</span>
      </label>

      <label className="field">
        <span>Caption (optional)</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={300} placeholder="Sunset rollers on Flagler. Two hours, 30 edits." />
      </label>

      <div className="row">
        <button className="btn solid" disabled={busy || uploading > 0} onClick={save}>{post ? "Save changes" : "Post the shoot"}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => router.push("/pro")}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="small muted">The car&apos;s owner can hide the post from their car&apos;s page. Their name is never shown.</p>
    </div>
  );
}

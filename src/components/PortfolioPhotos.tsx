"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compress, photoExt } from "@/lib/photos";
import { MAX_PHOTOS, MIN_PHOTOS, photoUrl } from "@/lib/types";

/**
 * A creator's portfolio: add photos, pick the cover, remove ones they don't want.
 * Used on the dashboard and on the profile editor, so uploading is never more than a tap away.
 */
export default function PortfolioPhotos({ userId, photos: initial, pageHref }: { userId: string; photos: string[]; pageHref?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  async function savePhotos(next: string[]) {
    setPhotos(next);
    const { error } = await supabase.from("pros").update({ photos: next, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) setError(error.message);
    router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`You can have up to ${MAX_PHOTOS} photos. Remove one to add another.`);
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Only the first ${room} were added. You can have up to ${MAX_PHOTOS} photos.`);
    const added: string[] = [];
    setUploading(list.length);
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
    if (added.length) await savePhotos([...photos, ...added]);
  }

  async function remove(path: string) {
    if (photos.length <= MIN_PHOTOS) return setError(`Keep at least ${MIN_PHOTOS} photos on your page. Add a new one first, then remove this one.`);
    setError("");
    await savePhotos(photos.filter((p) => p !== path));
    await supabase.storage.from("portfolio").remove([path]);
  }
  const full = photos.length >= MAX_PHOTOS;

  const picker = (label: string, cls: string) => (
    <label className={cls} style={{ cursor: uploading ? "progress" : "pointer" }}>
      {uploading ? `Uploading ${uploading}…` : label}
      <input type="file" accept="image/*" multiple hidden disabled={uploading > 0} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
    </label>
  );

  return (
    <div className="card portfolio" id="photos">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Your photos {photos.length > 0 && <span className="muted small">· {photos.length} of {MAX_PHOTOS}</span>}</h3>
        {photos.length > 0 && !full && picker("Add photos", "btn solid small")}
      </div>
      <p className="small muted" style={{ margin: "6px 0 14px" }}>
        Any car work you&apos;re proud of, old shoots too. The first photo is your cover and shows in the home feed.
        {pageHref && photos.length > 0 && <> <Link href={pageHref}>See them on your page</Link>.</>}
      </p>
      {photos.length < MIN_PHOTOS && (
        <p className="notice small" style={{ marginTop: 0 }}>
          Add {MIN_PHOTOS - photos.length} more photo{MIN_PHOTOS - photos.length === 1 ? "" : "s"} to show up in the creators list. Clients need to see at least {MIN_PHOTOS} of your shots.
        </p>
      )}
      {photos.length === 0 ? (
        picker("Tap to add photos from your phone or computer", "drop")
      ) : (
        <div className="gallery">
          {photos.map((ph, i) => (
            <div key={ph} className="shot-thumb">
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(ph)} alt="" />
                {i === 0 && <span className="cover-tag">Cover</span>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {i > 0 && <button type="button" className="btn small" onClick={() => savePhotos([ph, ...photos.filter((p) => p !== ph)])}>Cover</button>}
                <button type="button" className="btn small" onClick={() => remove(ph)} aria-label="Remove photo">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

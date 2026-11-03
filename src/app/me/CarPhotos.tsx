"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compress } from "@/lib/photos";
import { photoUrl } from "@/lib/types";

export const MAX_CAR_PHOTOS = 12;

/** The owner's own photos of one car: a row of thumbnails with add and remove. */
export default function CarPhotos({ userId, carId, photos: initial }: { userId: string; carId: string; photos: string[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState(initial);
  const latest = useRef(initial); // so an upload that finishes after a remove keeps the remove
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const room = MAX_CAR_PHOTOS - photos.length;

  async function save(next: string[]) {
    latest.current = next;
    setPhotos(next);
    const { error } = await supabase.from("cars").update({ photos: next }).eq("id", carId);
    if (error) setError(error.message);
    router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Up to ${MAX_CAR_PHOTOS} photos per car.`);
    const added: string[] = [];
    setUploading(list.length);
    for (const f of list) {
      try {
        const blob = await compress(f);
        const path = `${userId}/car-${carId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}.webp`;
        const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw error;
        added.push(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading((n) => n - 1);
    }
    if (added.length) await save([...latest.current, ...added].slice(0, MAX_CAR_PHOTOS));
  }

  async function remove(path: string) {
    await supabase.storage.from("portfolio").remove([path]);
    await save(latest.current.filter((p) => p !== path));
  }

  const picker = (label: string, cls: string) => (
    <label className={cls} style={{ cursor: uploading ? "progress" : "pointer" }}>
      {uploading ? `Uploading ${uploading}…` : label}
      <input type="file" accept="image/*" multiple hidden disabled={uploading > 0} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
    </label>
  );

  return (
    <div className="car-photos">
      {photos.length === 0 ? (
        picker("Add photos of your car", "drop small")
      ) : (
        <div className="car-strip">
          {photos.map((ph) => (
            <div key={ph} className="car-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(ph)} alt="" loading="lazy" />
              <button type="button" onClick={() => remove(ph)} aria-label="Remove photo">✕</button>
            </div>
          ))}
          {room > 0 && picker("+ Add", "car-thumb car-add")}
        </div>
      )}
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

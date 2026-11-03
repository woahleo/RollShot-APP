"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { squareAvatar } from "@/lib/photos";
import Avatar from "./Avatar";

/** Pick, crop and upload a profile picture. It shows on your page, in the feed and in the top bar. */
export default function AvatarUpload({ userId, name, avatar }: { userId: string; name: string; avatar: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [current, setCurrent] = useState(avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(path: string | null) {
    const { error } = await supabase.from("profiles").update({ avatar: path }).eq("id", userId);
    if (error) throw error;
    if (current && current !== path) await supabase.storage.from("portfolio").remove([current]);
    setCurrent(path);
    router.refresh();
  }

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const blob = await squareAvatar(f);
      const path = `${userId}/avatar-${crypto.randomUUID().slice(0, 8)}.webp`;
      const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      await save(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await save(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it");
    }
    setBusy(false);
  }

  return (
    <div className="avatar-upload">
      <Avatar name={name} avatar={current} size={72} />
      <div style={{ display: "grid", gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <label className="btn small" style={{ cursor: "pointer" }}>
            {busy ? "Saving…" : current ? "Change photo" : "Add a profile photo"}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => pick(e.target.files)} />
          </label>
          {current && <button type="button" className="btn small" disabled={busy} onClick={remove}>Remove</button>}
        </div>
        <span className="small muted">A clear photo of you or your logo. It&apos;s cropped to a circle.</span>
        {error && <span className="error small">{error}</span>}
      </div>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CITIES, KIND_LABEL, SHOOT_TYPES, photoUrl, type Kind, type Package, type Pro } from "@/lib/types";

/** Shrinks a photo to at most 2000px on the long side and re-encodes it as WebP (about 300 to 600 KB). */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read that image"))), "image/webp", 0.82));
}

export default function EditPro({ userId, pro, packages, contact }: { userId: string; pro: Pro; packages: Package[]; contact: { instagram: string | null; phone: string | null } | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [info, setInfo] = useState({ city: pro.city, kind: pro.kind ?? "photo", about: pro.about ?? "", shoot_types: pro.shoot_types });
  const [reach, setReach] = useState({ instagram: contact?.instagram ?? "", phone: contact?.phone ?? "" });
  const [photos, setPhotos] = useState(pro.photos);
  const [pkgs, setPkgs] = useState(packages.map((p) => ({ ...p })));
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(0);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("pros").update({ ...info, updated_at: new Date().toISOString() }).eq("id", userId);
    const { error: e2 } = await supabase.from("pro_contacts").upsert({ pro_id: userId, ...reach });
    setMsg(error?.message ?? e2?.message ?? "Profile saved.");
    router.refresh();
  }

  function toggleType(t: string) {
    const has = info.shoot_types.includes(t);
    setInfo({ ...info, shoot_types: has ? info.shoot_types.filter((x) => x !== t) : [...info.shoot_types, t] });
  }

  async function savePhotos(next: string[]) {
    setPhotos(next);
    const { error } = await supabase.from("pros").update({ photos: next, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) setMsg(error.message);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const added: string[] = [];
    setUploading(files.length);
    for (const f of Array.from(files).slice(0, 24)) {
      try {
        const blob = await compress(f);
        const path = `${userId}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw error;
        added.push(path);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading((n) => n - 1);
    }
    await savePhotos([...photos, ...added]);
  }

  async function removePhoto(path: string) {
    await supabase.storage.from("portfolio").remove([path]);
    await savePhotos(photos.filter((p) => p !== path));
  }

  async function makeCover(path: string) {
    await savePhotos([path, ...photos.filter((p) => p !== path)]);
  }

  async function savePackages() {
    const keep = pkgs.filter((p) => p.name.trim() && p.price > 0);
    const gone = packages.filter((p) => !keep.some((k) => k.id === p.id)).map((p) => p.id);
    if (gone.length) await supabase.from("packages").delete().in("id", gone);
    for (const [i, p] of keep.entries()) {
      const row = { pro_id: userId, name: p.name.trim(), price: Math.round(p.price), position: i };
      const { error } = p.id.startsWith("new-")
        ? await supabase.from("packages").insert(row)
        : await supabase.from("packages").update(row).eq("id", p.id);
      if (error) return setMsg(error.message);
    }
    setMsg("Packages saved.");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {msg && <p className="notice">{msg}</p>}

      <form className="card" onSubmit={saveInfo}>
        <h3>About you</h3>
        <label className="field"><span>City</span>
          <select value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="field"><span>What you do</span>
          <div className="chips">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button type="button" key={k} className="chip" aria-pressed={info.kind === k} onClick={() => setInfo({ ...info, kind: k })}>{KIND_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div className="field"><span>What you shoot</span>
          <div className="chips">
            {SHOOT_TYPES.map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={info.shoot_types.includes(t)} onClick={() => toggleType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <label className="field"><span>Bio (400 characters)</span>
          <textarea maxLength={400} value={info.about} onChange={(e) => setInfo({ ...info, about: e.target.value })} placeholder="Rolling shots on I-95, night shoots downtown…" />
        </label>
        <p className="small muted">Your Instagram and phone are shown only to clients with a confirmed shoot.</p>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label className="field" style={{ flex: 1 }}><span>Instagram</span>
            <input value={reach.instagram} maxLength={60} onChange={(e) => setReach({ ...reach, instagram: e.target.value.replace(/^@/, "") })} placeholder="yourhandle" />
          </label>
          <label className="field" style={{ flex: 1 }}><span>Phone</span>
            <input value={reach.phone} maxLength={30} type="tel" onChange={(e) => setReach({ ...reach, phone: e.target.value })} />
          </label>
        </div>
        <button className="btn solid">Save profile</button>
      </form>

      <div className="card">
        <h3>Packages</h3>
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {pkgs.map((p, i) => (
            <div key={p.id} className="row" style={{ flexWrap: "nowrap" }}>
              <input value={p.name} placeholder="Rolling shots, 20 edits" onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input type="number" min={1} style={{ maxWidth: 110 }} value={p.price || ""} placeholder="$"
                onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
              <button className="btn small" onClick={() => setPkgs(pkgs.filter((_, j) => j !== i))} aria-label="Remove package">✕</button>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setPkgs([...pkgs, { id: `new-${crypto.randomUUID()}`, pro_id: userId, name: "", price: 0, position: pkgs.length }])}>Add package</button>
          <button className="btn solid small" onClick={savePackages}>Save packages</button>
        </div>
      </div>

      <div className="card">
        <h3>Portfolio</h3>
        <p className="small muted">Photos are resized and compressed on your phone before upload, so they load fast. The first photo is your cover.</p>
        <label className="btn" style={{ marginBottom: 12 }}>
          {uploading ? `Uploading ${uploading}…` : "Add photos"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </label>
        <div className="gallery">
          {photos.map((ph, i) => (
            <div key={ph} style={{ display: "grid", gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(ph)} alt="" />
              <div className="row" style={{ gap: 6 }}>
                {i > 0 && <button className="btn small" onClick={() => makeCover(ph)}>Cover</button>}
                <button className="btn small" onClick={() => removePhoto(ph)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CityOptions from "@/components/CityOptions";
import { HANDLE_RE, KIND_LABEL, proPath, SHOOT_TYPES, type Kind, type Package, type Pro } from "@/lib/types";
import AvatarUpload from "@/components/AvatarUpload";
import PortfolioPhotos from "@/components/PortfolioPhotos";
import ReelPicker from "@/components/ReelPicker";

type Props = {
  userId: string; name: string; avatar: string | null; site: string;
  pro: Pro; packages: Package[]; contact: { instagram: string | null; phone: string | null } | null;
};

export default function EditPro({ userId, name, avatar, site, pro, packages, contact }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [info, setInfo] = useState({ city: pro.city, kind: pro.kind ?? "photo", about: pro.about ?? "", shoot_types: pro.shoot_types });
  const [reach, setReach] = useState({ instagram: contact?.instagram ?? "", phone: contact?.phone ?? "" });
  const [pkgs, setPkgs] = useState(packages.map((p) => ({ ...p })));
  const [msg, setMsg] = useState("");
  const [handle, setHandle] = useState(pro.handle ?? "");
  const [handleMsg, setHandleMsg] = useState("");

  async function saveHandle(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return setHandleMsg("Use 3 to 30 lowercase letters, numbers or dashes, like vic-films.");
    const { error } = await supabase.from("pros").update({ handle: h }).eq("id", userId);
    if (error) return setHandleMsg(error.code === "23505" ? "That username is taken. Try another." : error.message);
    setHandle(h);
    setHandleMsg("Saved. Your new link works now.");
    router.refresh();
  }

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

      <div className="card" style={{ display: "grid", gap: 18 }}>
        <h3 style={{ margin: 0 }}>Photo and link</h3>
        <AvatarUpload userId={userId} name={name} avatar={avatar} />
        <form onSubmit={saveHandle} style={{ display: "grid", gap: 8 }}>
          <label className="field" style={{ margin: 0 }}><span>Your link</span>
            <div className="handle-input">
              <span>{site.replace(/^https?:\/\//, "")}/p/</span>
              <input value={handle} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => { setHandleMsg(""); setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }} placeholder="your-name" />
            </div>
          </label>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn small solid" disabled={handle === (pro.handle ?? "")}>Save link</button>
            {handleMsg && <span className="small muted">{handleMsg}</span>}
          </div>
          <span className="small muted">This is the link to share on Instagram or text to clients. If you change it, the old one stops working.</span>
        </form>
      </div>

      <PortfolioPhotos userId={userId} photos={pro.photos} pageHref={proPath(pro)} />
      <ReelPicker userId={userId} reels={pro.reels ?? []} pageHref={proPath(pro)} />

      <form className="card" onSubmit={saveInfo}>
        <h3>About you</h3>
        <label className="field"><span>City</span>
          <select value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })}>
            <CityOptions />
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

    </div>
  );
}

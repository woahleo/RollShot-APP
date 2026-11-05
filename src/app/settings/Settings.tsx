"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";
import AvatarUpload from "@/components/AvatarUpload";

type Props = { userId: string; email: string; name: string; role: Role; label: string; photos: string[]; avatar: string | null; carPhotos?: string[] };

export default function Settings({ userId, email, name: initialName, role, label, photos, avatar, carPhotos = [] }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [msg, setMsg] = useState("");
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);
  const other: Role = role === "pro" ? "client" : "pro";
  const otherLabel = other === "pro" ? "creator" : "car owner";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", userId);
    setMsg(error ? error.message : "Name saved.");
    router.refresh();
  }

  async function switchRole() {
    setBusy(true);
    if (other === "client" && photos.length) await supabase.storage.from("portfolio").remove(photos);
    const { error } = await supabase.rpc("switch_role", { p_role: other });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace(other === "pro" ? "/pro/edit" : "/book");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    const files = [...photos, ...carPhotos, ...(avatar ? [avatar] : [])];
    if (files.length) await supabase.storage.from("portfolio").remove(files);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { setBusy(false); return setMsg(error.message); }
    await supabase.auth.signOut();
    router.replace("/?deleted=1");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && <p className="notice">{msg}</p>}

      <form className="card" onSubmit={saveName}>
        <h3>Account</h3>
        <AvatarUpload userId={userId} name={initialName} avatar={avatar} />
        <label className="field"><span>{email.startsWith("+") ? "Phone" : "Email"}</span><input value={email} disabled /></label>
        <label className="field"><span>Name</span><input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn solid">Save name</button>
      </form>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Account type</h3>
        <p style={{ margin: 0 }}>This account is a <span className="badge">{label}</span></p>
        {!confirmSwitch ? (
          <button className="btn" style={{ justifySelf: "start" }} onClick={() => setConfirmSwitch(true)}>Switch to {otherLabel}</button>
        ) : (
          <div className="notice" style={{ display: "grid", gap: 10 }}>
            {other === "client" ? (
              <span>Switching to a car owner removes your creator profile, photos, packages, open dates, and the bookings and chats clients made with you. This can&apos;t be undone.</span>
            ) : (
              <span>Switching to a creator cancels any shoots you requested as a car owner. Your garage stays saved. You&apos;ll set up your creator profile next.</span>
            )}
            <div className="row">
              <button className="btn solid" disabled={busy} onClick={switchRole}>Yes, switch to {otherLabel}</button>
              <button className="btn" onClick={() => setConfirmSwitch(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <form action="/auth/signout" method="post" className="card">
        <h3>Sign out</h3>
        <button className="btn" type="submit">Sign out</button>
      </form>

      <div className="card" style={{ display: "grid", gap: 10, borderColor: "var(--bad)" }}>
        <h3 style={{ margin: 0 }}>Delete account</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Permanently deletes your account, profile, {role === "pro" ? "photos, packages, " : "garage, "}bookings and messages. Type DELETE to confirm.
        </p>
        <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
        <button className="btn" style={{ justifySelf: "start", color: "var(--bad)", borderColor: "var(--bad)" }} disabled={busy || confirmDelete !== "DELETE"} onClick={deleteAccount}>
          Delete my account
        </button>
      </div>
    </div>
  );
}

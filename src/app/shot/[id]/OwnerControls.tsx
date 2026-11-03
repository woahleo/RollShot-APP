"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The photographer can take a post down; the car's owner can hide it. */
export default function OwnerControls({ id, isPro, isOwner, hidden }: { id: string; isPro: boolean; isOwner: boolean; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!isPro && !isOwner) return null;

  async function call(fn: string, args: Record<string, unknown>, go?: string) {
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message);
    if (go) router.push(go);
    else router.refresh();
  }

  return (
    <div className="notice" style={{ marginTop: 28, display: "grid", gap: 8 }}>
      <b style={{ fontWeight: 400 }}>{isPro ? "Your post" : "Your car"}</b>
      <span className="muted">
        {isPro
          ? "Car owners can hide a post of their car. Taking it down removes it from your page too."
          : hidden
            ? "This post is hidden. Nobody else can see it."
            : "This post shows on the photographer's page and your car's page. Your name is never on it."}
      </span>
      <div className="row" style={{ gap: 8 }}>
        {isPro && (
          <button className="btn small" disabled={busy} onClick={() => call("delete_shoot_post", { p_post: id }, "/pro")}>Take it down</button>
        )}
        {isOwner && (
          <button className="btn small" disabled={busy} onClick={() => call("hide_shoot_post", { p_post: id, p_hidden: !hidden })}>
            {hidden ? "Show it again" : "Hide this post"}
          </button>
        )}
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

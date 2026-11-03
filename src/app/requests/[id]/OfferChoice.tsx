"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Message a photographer about their offer, or choose them (which books the shoot). */
export default function OfferChoice({ requestId, proId, name, price, date }: { requestId: string; proId: string; name: string; price: number; date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function message() {
    setBusy(true);
    const { data, error } = await createClient().rpc("open_request_chat", { p_request: requestId, p_pro: proId });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    router.push(`/messages/${data}`);
  }
  async function choose() {
    if (!confirm(`Book ${name} for ${date} at $${price}? The other offers will be turned down.`)) return;
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("choose_offer", { p_request: requestId, p_pro: proId });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn small" disabled={busy} onClick={message}>Message</button>
      <button type="button" className="btn pink small" disabled={busy} onClick={choose}>Choose {name.split(" ")[0]}</button>
      {error && <p className="error" style={{ margin: 0, width: "100%" }}>{error}</p>}
    </>
  );
}

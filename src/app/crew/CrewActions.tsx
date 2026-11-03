"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function useCall() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function call(fn: string, args: Record<string, unknown>, then?: (data: unknown) => void) {
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message);
    if (then) then(data);
    router.refresh();
  }
  return { busy, error, call };
}

/** Accept or decline a direct offer. */
export function AnswerOffer({ gig }: { gig: string }) {
  const router = useRouter();
  const { busy, error, call } = useCall();
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn solid small" disabled={busy} onClick={() => call("answer_gig", { p_gig: gig, p_accept: true }, (t) => router.push(`/messages/${t}`))}>Accept</button>
        <button className="btn small" disabled={busy} onClick={() => call("answer_gig", { p_gig: gig, p_accept: false })}>Decline</button>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** "I'm in" on a posted job, with an optional line about why you're a fit. */
export function ReplyJob({ gig, replied }: { gig: string; replied: boolean }) {
  const router = useRouter();
  const { busy, error, call } = useCall();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (replied) return <span className="badge requested">You&apos;re in · waiting on them</span>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {open ? (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you're a fit (optional)" maxLength={300} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn solid small" disabled={busy} onClick={() => call("reply_gig", { p_gig: gig, p_note: note }, (t) => router.push(`/messages/${t}`))}>Send</button>
            <button className="btn small" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <button className="btn solid small" onClick={() => setOpen(true)}>I&apos;m in</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** Poster picks one of the creators who replied. */
export function PickReply({ gig, pro, name }: { gig: string; pro: string; name: string }) {
  const router = useRouter();
  const { busy, error, call } = useCall();
  return (
    <>
      <button className="btn solid small" disabled={busy} onClick={() => call("choose_gig_reply", { p_gig: gig, p_pro: pro }, (t) => router.push(`/messages/${t}`))}>Pick {name.split(" ")[0]}</button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** Take down an open job, or withdraw a direct offer. */
export function CloseJob({ gig, direct }: { gig: string; direct: boolean }) {
  const { busy, error, call } = useCall();
  const [sure, setSure] = useState(false);
  return (
    <>
      {sure ? (
        <span className="row" style={{ gap: 8 }}>
          <button className="btn small" disabled={busy} onClick={() => call("close_gig", { p_gig: gig })}>{direct ? "Yes, withdraw" : "Yes, take it down"}</button>
          <button className="btn small" onClick={() => setSure(false)}>Keep it</button>
        </span>
      ) : (
        <button className="btn small" onClick={() => setSure(true)}>{direct ? "Withdraw offer" : "Take down"}</button>
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}

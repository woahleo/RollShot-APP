"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message, Package } from "@/lib/types";
import OfferCard from "./OfferCard";
import OfferComposer from "./OfferComposer";

type Props = {
  threadId: string;
  userId: string;
  isPro: boolean;
  initial: Message[];
  confirmed: boolean;
  requested: boolean;
  unlimited: boolean;
  startOffer?: boolean;
  otherName: string;
  packages: Package[];
  openDates: string[];
  cars: string[];
};

const merge = (prev: Message[], next: Message[]) => {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of next) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
};

export default function Chat({ threadId, userId, isPro, initial, confirmed, requested, unlimited, startOffer = false, otherName, packages, openDates, cars }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(startOffer);
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const lastSystem = useRef(initial.filter((m) => m.kind === "system").length);

  useEffect(() => {
    const supabase = createClient();
    const take = (m: Message) => setMessages((prev) => merge(prev, [m]));
    const ch = supabase
      .channel(`thread-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (p) => take(p.new as Message))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (p) => take(p.new as Message))
      .subscribe();
    // Backup for when live updates are slow or blocked: re-read the chat every few seconds while it's on screen.
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at");
      if (data) setMessages((prev) => merge(prev, data as Message[]));
    }, 5000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [threadId]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
    // A system note means a booking or the message limit changed: reload the page's data.
    const systems = messages.filter((m) => m.kind === "system").length;
    if (systems !== lastSystem.current) {
      lastSystem.current = systems;
      router.refresh();
    }
  }, [messages, router]);

  useEffect(() => {
    if (!composing) log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [composing]);

  const sentByClient = messages.filter((m) => m.kind === "text" && m.sender_id === userId).length;
  const left = !isPro && !requested && !unlimited ? Math.max(0, 3 - sentByClient) : null;
  const first = otherName.split(" ")[0];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError("");
    const { data, error } = await createClient().from("messages").insert({ thread_id: threadId, body }).select().single();
    if (error) return setError(error.message);
    setText("");
    setMessages((prev) => merge(prev, [data as Message]));
  }

  async function toggleUnlimited() {
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("set_thread_unlimited", { p_thread: threadId, p_on: !unlimited });
    setBusy(false);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="chat">
      {composing ? (
        <OfferComposer
          threadId={threadId}
          context={messages.filter((m) => m.kind === "system").at(-1)?.body}
          packages={packages}
          openDates={openDates}
          onClose={() => setComposing(false)}
          onSent={(m) => {
            setComposing(false);
            setMessages((prev) => merge(prev, [m]));
          }}
        />
      ) : (
        <div className="log" ref={log}>
          {messages.length === 0 && <p className="msg system">Say hi. Ask about the shot, the spot, or the timing.</p>}
          {messages.map((m) =>
            m.kind === "offer" ? (
              <OfferCard key={m.id} m={m} isPro={isPro} otherName={first} cars={cars} onBooked={() => router.refresh()} />
            ) : (
              <div key={m.id} className={`msg ${m.kind === "system" ? "system" : m.sender_id === userId ? "mine" : ""}`}>{m.body}</div>
            ),
          )}
        </div>
      )}
      {isPro && !composing && (
        <div className="chat-tools">
          <button type="button" className="btn solid small" onClick={() => setComposing(true)}>Offer dates</button>
          {!confirmed && !requested && (
            <button type="button" className="btn small" disabled={busy} onClick={toggleUnlimited}>
              {unlimited ? `Limit ${first}'s messages` : `Let ${first} message more`}
            </button>
          )}
        </div>
      )}
      {!confirmed && !composing && (
        <p className="small muted" style={{ margin: "0 0 6px" }}>
          Phone numbers and handles unlock once the shoot is confirmed.
          {left !== null && ` ${left} message${left === 1 ? "" : "s"} left before you request a date.`}
          {isPro && !requested && !unlimited && ` ${first} can send 3 messages before booking.`}
        </p>
      )}
      {error && <p className="error" style={{ margin: "0 0 6px" }}>{error}</p>}
      {!composing && <form onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={2000} disabled={left === 0} />
        <button className="btn solid" disabled={left === 0}>Send</button>
      </form>}
    </div>
  );
}

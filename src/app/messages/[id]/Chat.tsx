"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

type Props = { threadId: string; userId: string; isPro: boolean; initial: Message[]; confirmed: boolean; requested: boolean };

export default function Chat({ threadId, userId, isPro, initial, confirmed, requested }: Props) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`thread-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId]);

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages]);

  const sentByClient = messages.filter((m) => m.kind === "text" && m.sender_id === userId).length;
  const left = !isPro && !requested ? Math.max(0, 3 - sentByClient) : null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError("");
    const { data, error } = await createClient().from("messages").insert({ thread_id: threadId, body }).select().single();
    if (error) return setError(error.message);
    setText("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  }

  return (
    <div className="chat">
      <div className="log" ref={log}>
        {messages.length === 0 && <p className="msg system">Say hi. Ask about the shot, the spot, or the timing.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.kind === "system" ? "system" : m.sender_id === userId ? "mine" : ""}`}>{m.body}</div>
        ))}
      </div>
      {!confirmed && (
        <p className="small muted" style={{ margin: "0 0 6px" }}>
          Phone numbers and handles unlock once the shoot is confirmed.
          {left !== null && ` ${left} message${left === 1 ? "" : "s"} left before you request a date.`}
        </p>
      )}
      {error && <p className="error" style={{ margin: "0 0 6px" }}>{error}</p>}
      <form onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={2000} disabled={left === 0} />
        <button className="btn solid" disabled={left === 0}>Send</button>
      </form>
    </div>
  );
}

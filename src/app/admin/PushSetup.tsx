"use client";
import { useEffect, useState } from "react";

type Props = { appReady: boolean; dbLinked: boolean; pgNet: boolean; devices: number; secret: string | null; linkedUrl: string | null };

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Push keys made in this browser, so they never pass through anyone else. */
async function makeKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = await crypto.subtle.exportKey("raw", pair.publicKey);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { pub: b64url(pub), priv: jwk.d!, secret: b64url(crypto.getRandomValues(new Uint8Array(24))) };
}

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="setup-val">
      <span className="small muted">{label}</span>
      <code>{value}</code>
      <button type="button" className="btn small" onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Setup and a test button for phone alerts. The bell in the app works without any of this. */
export default function PushSetup({ appReady, dbLinked, pgNet, devices, secret, linkedUrl }: Props) {
  const [keys, setKeys] = useState<{ pub: string; priv: string; secret: string } | null>(null);
  const [origin, setOrigin] = useState("https://roll-shot-app.vercel.app");
  const [test, setTest] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    if (!appReady) makeKeys().then(setKeys);
  }, [appReady]);
  const url = `${origin}/api/push`;
  const done = appReady && dbLinked && pgNet && linkedUrl === url;
  const sqlSecret = secret ?? keys?.secret ?? "…";
  const sql = `insert into private.push_config (id, url, secret) values (1, '${url}', '${sqlSecret}')\n  on conflict (id) do update set url = excluded.url, secret = excluded.secret;`;

  async function sendTest() {
    setTest("Sending…");
    const res = await fetch("/api/push/test", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setTest(res.ok ? (j.sent ? `Sent to ${j.sent} device${j.sent === 1 ? "" : "s"}. Check your phone.` : "No devices yet. Turn on alerts on the Notifications page first.") : j.error ?? "That didn't work");
  }

  return (
    <section className="card" style={{ marginTop: 28 }} id="push">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Phone alerts</h3>
        <span className={`badge ${done ? "confirmed" : "requested"}`}>{done ? "Working" : "Needs setup"}</span>
      </div>
      <p className="small muted" style={{ margin: "6px 0 12px" }}>
        The bell in the app works already. Phone alerts also need the steps below, once. {devices} device{devices === 1 ? " has" : "s have"} alerts turned on.
      </p>
      <ol className="setup">
        <li className={appReady ? "ok" : ""}>
          <b>Add three settings in Vercel</b>
          {appReady ? (
            <span className="small muted">Done.</span>
          ) : (
            <>
              <span className="small muted">
                Vercel → your project → Settings → Environment Variables. Add these three, then redeploy (Deployments → ⋯ → Redeploy).
                These keys were made just now in your browser and aren&apos;t saved anywhere, so copy all three before leaving this page.
              </span>
              {keys && (
                <>
                  <Copy label="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={keys.pub} />
                  <Copy label="VAPID_PRIVATE_KEY" value={keys.priv} />
                  <Copy label="PUSH_SECRET" value={keys.secret} />
                </>
              )}
            </>
          )}
        </li>
        <li className={pgNet ? "ok" : ""}>
          <b>Turn on pg_net in Supabase</b>
          <span className="small muted">{pgNet ? "Done." : "Supabase → Database → Extensions → search pg_net → enable. It lets the database call the app."}</span>
        </li>
        <li className={dbLinked && linkedUrl === url ? "ok" : ""}>
          <b>Link the database to the app</b>
          {dbLinked && linkedUrl === url ? (
            <span className="small muted">Done.</span>
          ) : (
            <>
              <span className="small muted">
                {appReady ? "Run this in the Supabase SQL Editor." : "After step 1, run this in the Supabase SQL Editor. It uses the same PUSH_SECRET as above."}
                {dbLinked && linkedUrl !== url ? ` It's linked to ${linkedUrl} right now.` : ""}
              </span>
              <Copy label="SQL" value={sql} />
            </>
          )}
        </li>
      </ol>
      {appReady && (
        <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
          <button type="button" className="btn small" onClick={sendTest}>Send me a test alert</button>
          {test && <span className="small muted">{test}</span>}
        </div>
      )}
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isApp } from "@/lib/app";
import { appPushPermission, appPushTurnedOff, turnOffAppPush, turnOnAppPush } from "@/lib/appPush";

type State = "loading" | "unsupported" | "install" | "off" | "on" | "blocked" | "unset";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** Turns phone alerts on or off for this device. On iPhone they only work once Rollshot is on the Home Screen. */
export default function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [app, setApp] = useState(false);

  useEffect(() => {
    (async () => {
      if (isApp()) {
        setApp(true);
        const perm = await appPushPermission();
        return setState(perm === "denied" ? "blocked" : perm === "granted" && !appPushTurnedOff() ? "on" : "off");
      }
      if (!KEY) return setState("unset");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isInstalled() ? "install" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError("");
    try {
      if (app) return setState(await turnOnAppPush());
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const j = sub.toJSON();
      const { error } = await createClient().rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
      if (error) throw error;
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on alerts");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError("");
    try {
      if (app) {
        await turnOffAppPush();
        return setState("off");
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await createClient().rpc("forget_push_subscription", { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn off alerts");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unset") return null;
  if (compact && state === "on") return null;

  return (
    <div className="card push-card">
      <div>
        <b>Phone alerts</b>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          {state === "on" && "On for this device. You'll get an alert for new requests, offers, bookings and messages."}
          {state === "off" && "Get an alert on this device the moment someone posts a request, books you or messages you."}
          {state === "blocked" && (app
            ? "Alerts are off for Rollshot. Turn them on in your iPhone's Settings → Rollshot → Notifications, then come back."
            : "Alerts are blocked for Rollshot in this browser. Allow notifications for this site in your browser or phone settings, then come back.")}
          {state === "unsupported" && "This browser can't show alerts. Try Chrome or Safari, or add Rollshot to your Home Screen."}
          {state === "install" && (
            <>On iPhone, add Rollshot to your Home Screen first: tap the Share button <span aria-hidden="true">(□↑)</span>, then <b style={{ fontWeight: 400 }}>Add to Home Screen</b>. Open it from there and turn alerts on.</>
          )}
        </p>
        {error && <p className="error small" style={{ margin: "6px 0 0" }}>{error}</p>}
      </div>
      {state === "off" && <button className="btn solid small" disabled={busy} onClick={turnOn}>Turn on</button>}
      {state === "on" && <button className="btn small" disabled={busy} onClick={turnOff}>Turn off</button>}
    </div>
  );
}

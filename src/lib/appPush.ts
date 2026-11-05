"use client";
import { createClient } from "@/lib/supabase/client";

/** Phone alerts inside the iPhone app go through Apple's push service rather than the browser's. */
const TOKEN = "rs-apns";
const OFF = "rs-apns-off";

const load = () => import("@capacitor/push-notifications").then((m) => m.PushNotifications);
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

export async function appPushPermission() {
  return (await (await load()).checkPermissions()).receive; // "granted" | "denied" | "prompt" | "prompt-with-rationale"
}

export const appPushTurnedOff = () => get(OFF) === "1";

/** Asks iPhone for permission if needed, then saves this phone's push address to the account. */
export async function turnOnAppPush(): Promise<"on" | "blocked" | "off"> {
  const push = await load();
  let perm = (await push.checkPermissions()).receive;
  if (perm !== "granted" && perm !== "denied") perm = (await push.requestPermissions()).receive;
  if (perm === "denied") return "blocked";
  if (perm !== "granted") return "off";
  const token = await new Promise<string>((resolve, reject) => {
    const subs: { remove: () => Promise<void> }[] = [];
    const done = () => subs.forEach((s) => s.remove());
    Promise.all([
      push.addListener("registration", (t) => { done(); resolve(t.value); }),
      push.addListener("registrationError", (e) => { done(); reject(new Error(e.error || "iPhone didn't give a push address")); }),
    ]).then((ls) => { subs.push(...ls); return push.register(); }).catch(reject);
  });
  const endpoint = `apns:${token.toLowerCase()}`;
  const { error } = await createClient().rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: "apns", p_auth: "apns" });
  if (error) throw error;
  set(TOKEN, endpoint);
  set(OFF, null);
  return "on";
}

export async function turnOffAppPush() {
  const endpoint = get(TOKEN);
  if (endpoint) await createClient().rpc("forget_push_subscription", { p_endpoint: endpoint });
  await (await load()).unregister().catch(() => {});
  set(TOKEN, null);
  set(OFF, "1");
}

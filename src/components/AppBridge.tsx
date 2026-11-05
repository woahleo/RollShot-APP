"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isApp } from "@/lib/app";
import { appPushPermission, appPushTurnedOff, turnOnAppPush } from "@/lib/appPush";

const ASKED = "rs-apns-asked";

/**
 * Only does anything inside the iPhone app: keeps this phone's push address saved, asks for alerts
 * once (after the first-time tour, if one is showing), and opens the right page when an alert is tapped.
 */
export default function AppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isApp()) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    import("@capacitor/push-notifications").then(async ({ PushNotifications }) => {
      const l = await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const href = (a.notification.data as { href?: string } | undefined)?.href;
        if (href && href.startsWith("/") && !href.startsWith("//")) router.push(href);
      });
      cleanups.push(() => l.remove());
    }).catch(() => {});

    (async () => {
      const perm = await appPushPermission();
      if (cancelled || appPushTurnedOff()) return;
      if (perm === "granted") return void turnOnAppPush().catch(() => {}); // keep the saved address fresh
      if (perm === "denied") return;
      try { if (localStorage.getItem(ASKED)) return; } catch {}
      const ask = () => {
        try { localStorage.setItem(ASKED, "1"); } catch {}
        turnOnAppPush().catch(() => {});
      };
      // Let a first-time tour finish before iPhone's permission prompt covers it.
      await new Promise((r) => setTimeout(r, 2500));
      if (cancelled) return;
      if (document.querySelector(".tour")) {
        const onDone = () => ask();
        window.addEventListener("rs-tour-done", onDone, { once: true });
        cleanups.push(() => window.removeEventListener("rs-tour-done", onDone));
      } else ask();
    })().catch(() => {});

    return () => { cancelled = true; cleanups.forEach((c) => c()); };
  }, [router]);

  return null;
}

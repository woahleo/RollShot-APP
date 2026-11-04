// Rollshot service worker: shows phone alerts and opens the right page when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Rollshot", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "Rollshot", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { href: d.href || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.href || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

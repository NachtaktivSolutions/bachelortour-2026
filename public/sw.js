self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Firestarter 2026", {
    body: data.body || "Es gibt Neuigkeiten.",
    icon: "/api/branding/icon?v=16",
    badge: "/api/branding/icon?v=16",
    image: data.image || undefined,
    tag: data.tag || "firestarter-2026",
    renotify: true,
    requireInteraction: false,
    timestamp: data.timestamp || Date.now(),
    vibrate: [180, 80, 180],
    silent: false,
    data: { url: data.url || "/" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ("focus" in client) { client.navigate(event.notification.data.url); return client.focus(); }
    }
    return clients.openWindow(event.notification.data.url);
  }));
});

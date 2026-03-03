// Service Worker for push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "abbey-crm",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title || "Abbey CRM", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

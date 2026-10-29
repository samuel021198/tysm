self.addEventListener("push", (event) => {
  let title = "TSM";
  let body = "";
  let href = "/notifications";
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data === "object") {
      if (typeof data.title === "string" && data.title) title = data.title.slice(0, 80);
      if (typeof data.body === "string") body = data.body.slice(0, 180);
      if (typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//")) href = data.href;
    }
  } catch {
    /* keep the inbox fallback */
  }
  event.waitUntil(self.registration.showNotification(title, { body, data: { href }, tag: href }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.href;
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/notifications";
  event.waitUntil(self.clients.openWindow(new URL(path, self.location.origin).href));
});

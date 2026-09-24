// Replaces the service worker the detailed firefighter map registered back when it lived here (it's now in ../firefighter-maps/detailed/), so browsers that installed it stop using it: when one checks for an update, it gets this, which unregisters itself and reloads its pages -- which then redirect. Its caches are left alone, since the map's new service worker uses the same ones.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url))),
  );
});

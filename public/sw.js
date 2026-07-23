self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Business data remains network-only so invoices and stock levels never come
// from an outdated offline cache.

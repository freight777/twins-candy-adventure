// Loaded by the Workbox service worker: delete the caches left by the old hand-written service worker ("games-v1" ... "games-v7").
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => /^games-v\d+$/.test(k)).map((k) => caches.delete(k)))));
});

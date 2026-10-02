// Offline support: serve from cache first, refresh the cache in the background.
// Bump VERSION when you want everyone to drop old files immediately.
const VERSION = 'candy-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {       // the page itself: always try for the newest version first, fall back to offline copy
    e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./', copy)); return res; })
      .catch(() => caches.match('./')));
    return;
  }
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: false });
      const net = fetch(e.request).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }),
  );
});

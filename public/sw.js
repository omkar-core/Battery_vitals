// sw.js — Service Worker for the Next.js Battery Vital app
// Strategy: navigation → network-first w/ offline fallback
//           _next/assets → stale-while-revalidate
//           everything else (non-API) → cache-first
const CACHE_NAME = 'bv-cache-v5';
const PRECACHE = ['/', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Only handle http(s) requests (avoids chrome-extension://, data:, blob:).
  if (request.url.indexOf('http') !== 0) return;

  const url = new URL(request.url);

  // API requests: network only, never cached.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request));
    return;
  }

  // Page navigations: network-first, fall back to cached shell for offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/offline-shell', clone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('/offline-shell').then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // Hashed Next.js build assets & fonts: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => {
            if (resp.ok) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else (images, manifest, favicon): cache-first.
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((resp) => {
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        });
      })
    )
  );
});
// sw.js — Bulletproof Service Worker for Next.js Battery Vital app
const CACHE_NAME = 'bv-cache-v7';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // 1. Ignore non-HTTP requests (chrome-extension://, data:, blob:)
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // 2. Bypass ALL API requests — let browser handle natively
  if (url.pathname.startsWith('/api/')) return;

  // 3. Bypass ALL Next.js internals (RSC payloads, static chunks, build data).
  //    Serving stale copies of these breaks Next's client-side router and causes
  //    "Failed to fetch RSC payload ... reading 'call'" navigation errors.
  if (
    url.pathname.startsWith('/_next/') ||
    url.search.includes('_rsc=') ||
    url.pathname.includes('.next') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree')
  ) {
    return;
  }

  // 4. Navigation requests — network-first; only use cache as offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(
          '<html><body><h2>Battery Vital - Connection Timeout</h2><p>Server is waking up. Please refresh in a few seconds.</p><script>setTimeout(()=>location.reload(), 3000)</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // 5. Static assets — cache-first for offline resilience
  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const resp = await fetch(request);
        if (resp && resp.ok && resp.type === 'basic') {
          cache.put(request, resp.clone()).catch(() => {});
        }
        return resp;
      } catch (err) {
        return cached || new Response('', { status: 408, statusText: 'Request Timeout' });
      }
    })
  );
});

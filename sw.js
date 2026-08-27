// sw.js — Service Worker for offline caching
const CACHE_NAME = 'bv-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/router.js',
  '/js/telemetry.js',
  '/js/charts.js',
  '/js/controls.js',
  '/js/alerts.js',
  '/js/settings.js',
  '/js/ai.js',
  '/js/passport.js',
  '/js/diagnostics.js',
  '/js/export.js',
  '/js/history.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

const CACHE_NAME = 'medtranslate-v1';
const STATIC_ASSETS = ['/', '/index.html', '/styles/main.css', '/src/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for static assets
  if (e.request.url.includes('/.netlify/functions/')) {
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

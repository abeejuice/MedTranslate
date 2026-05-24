const CACHE_NAME = 'medtranslate-v1';
const STATIC_ASSETS = [
  '/', '/index.html', '/styles/main.css', '/src/app.js',
  '/src/router.js', '/src/db.js', '/src/toast.js', '/src/utils.js',
  '/src/data/templates.js',
  '/src/screens/home.js', '/src/screens/session-setup.js',
  '/src/screens/session.js', '/src/screens/session-summary.js',
  '/src/screens/past-sessions.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

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

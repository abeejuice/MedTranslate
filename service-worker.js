const CACHE_NAME = 'medtranslate-v8';
const STATIC_ASSETS = [
  '/', '/index.html', '/styles/main.css', '/src/app.js',
  '/src/router.js', '/src/db.js', '/src/toast.js', '/src/utils.js',
  '/src/animations.js',
  '/src/data/templates.js',
  '/src/screens/home.js', '/src/screens/session-setup.js',
  '/src/screens/session.js', '/src/screens/session-summary.js',
  '/src/screens/past-sessions.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('/api/')) {
    // Network-first for API calls
    e.respondWith(fetch(e.request));
  } else if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    // Cache-first for Google Fonts — serves offline after first load
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            if (response && response.status === 200) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(() => cached);
        })
      )
    );
  } else {
    // Cache-first for all other static assets
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

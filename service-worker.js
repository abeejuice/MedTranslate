const CACHE_NAME = 'medtranslate-v19';
const STATIC_ASSETS = [
  '/styles/main.css', '/src/app.js',
  '/src/router.js', '/src/db.js', '/src/toast.js', '/src/utils.js',
  '/src/animations.js',
  '/src/data/templates.js',
  '/src/screens/home.js', '/src/screens/session-setup.js',
  '/src/screens/session.js', '/src/screens/session-summary.js',
  '/src/screens/past-sessions.js', '/src/screens/quick-opd.js',
  '/icons/GalenAI-FInal Logo-01.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
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
          }).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
        })
      )
    );
  } else if (url.endsWith('/') || url.includes('.html')) {
    // Network-first for HTML — ensures CSP headers are always fresh
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for all other static assets
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).catch(() => new Response('', { status: 404 }))
      )
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

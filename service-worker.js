const CACHE_NAME = 'fc25-score-tracker-v116';

// Determine base path from the SW scope.
// - Root scope is usually "/"  -> BASE_PATH = ""
// - GitHub Pages scope might be "/Fc25-score-keeper/" -> BASE_PATH = "/Fc25-score-keeper"
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const BASE_PATH = SCOPE_PATH === '/' ? '' : SCOPE_PATH;

const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/styles.css`,
  // Split application scripts (same-origin only)
  `${BASE_PATH}/src/constants.js`,
  `${BASE_PATH}/src/persistence.js`,
  `${BASE_PATH}/src/settings.js`,
  `${BASE_PATH}/src/players.js`,
  `${BASE_PATH}/src/team-generator.js`,
  `${BASE_PATH}/src/stats-calculators.js`,
  `${BASE_PATH}/src/statistics-tracker.js`,
  `${BASE_PATH}/src/toast.js`,
  `${BASE_PATH}/src/statistics-display.js`,
  `${BASE_PATH}/src/match.js`,
  `${BASE_PATH}/src/season.js`,
  `${BASE_PATH}/src/share.js`,
  `${BASE_PATH}/src/touch.js`,
  `${BASE_PATH}/src/app-controller.js`,
  `${BASE_PATH}/src/api-service.js`,
  `${BASE_PATH}/src/data-handler.js`,
  `${BASE_PATH}/src/debug-log.js`,
  `${BASE_PATH}/src/stats-view-toggler-global.js`,
  `${BASE_PATH}/src/main.js`,
  // Legacy single-bundle (kept for compatibility)
  `${BASE_PATH}/app.js`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        // Fetch fresh versions with cache busting (same-origin URLs only)
        return Promise.all(urlsToCache.map((url) => {
          return fetch(url + '?v=' + CACHE_NAME + '&t=' + Date.now(), { cache: 'no-store' })
            .then(response => {
              if (response.ok) {
                // Store without query params for clean cache keys
                return cache.put(url, response);
              }
            })
            .catch(err => {
              console.error('Failed to cache:', url, err);
              // Fallback: try without cache busting
              return fetch(url).then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              });
            });
        }));
      })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network first for app files, cache for offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppFile = isSameOrigin && (
    url.pathname.endsWith('.js') ||
                    url.pathname.endsWith('.css') || 
    url.pathname.endsWith('.html')
  );
  
  if (isAppFile) {
    // Network first strategy for app files to get latest updates
    // Add cache busting for app files to ensure fresh content
    const requestUrl = event.request.url.split('?')[0] + '?v=' + Date.now();
    event.respondWith(
      fetch(requestUrl, { cache: 'no-cache' })
        .then((response) => {
          // Update cache with fresh response (without query param)
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Store without query param for future cache lookups
              cache.put(event.request.url.split('?')[0], responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache (without query param)
          return caches.match(event.request.url.split('?')[0]);
        })
    );
  } else {
    // For cross-origin requests, pass through to network (no caching).
    // For same-origin non-app assets (icons, etc.), cache-first is fine.
    const cacheFirst = isSameOrigin ? caches.match(event.request) : Promise.resolve(null);
    event.respondWith(
      cacheFirst
        .then((cached) => cached || fetch(event.request))
        .catch((err) => {
          if (event.request.mode === 'navigate') {
            return caches.match(`${BASE_PATH}/index.html`) || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          }
          throw err;
        })
    );
  }
});


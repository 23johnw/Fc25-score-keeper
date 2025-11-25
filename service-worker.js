const CACHE_NAME = 'fc25-score-tracker-v16';
const BASE_PATH = '/Fc25-score-keeper';
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/styles.css`,
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
        // Fetch fresh versions with cache busting
        return Promise.all(urlsToCache.map(url => {
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
  const isAppFile = url.pathname.endsWith('.js') || 
                    url.pathname.endsWith('.css') || 
                    url.pathname.endsWith('.html');
  
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
    // Cache first for other assets (icons, etc.)
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
        .catch(() => {
          // If both fail, return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(`${BASE_PATH}/index.html`);
          }
        })
    );
  }
});


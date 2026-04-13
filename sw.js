/* =============================================
   FINANZAPP — SERVICE WORKER v2
   Estrategia: Cache First + Network Fallback
   ============================================= */

const CACHE_NAME = 'finanzapp-v3';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// URLs que NUNCA deben cachearse (Firebase, CDNs dinámicos)
const BYPASS_PATTERNS = [
  'firebaseapp.com',
  'googleapis.com/identitytoolkit',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'gstatic.com/firebasejs',
];

function shouldBypass(url) {
  return BYPASS_PATTERNS.some(p => url.includes(p));
}

// INSTALL — pre-cachea los assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — elimina cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH — Cache First, skip Firebase URLs
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (shouldBypass(event.request.url)) return; // Firebase maneja sus propias requests

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

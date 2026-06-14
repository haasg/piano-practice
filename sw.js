/* Piano Practice — service worker for offline use at the piano.
   Bump CACHE when lesson/reference files change so the iPad pulls fresh copies. */
const CACHE = 'piano-practice-v5';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './lessons/0001-five-scales-one-fingering.html',
  './lessons/0002-twelve-scales-three-shapes.html',
  './lessons/0002-workout.html',
  './reference/scale-fingerings.html',
  './notation-studio.html',
  './vendor/abcjs-basic-min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Cache-first, then network; update the cache in the background.
   Navigations fall back to the cached home page when offline. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => null);

      return cached || network.then((res) => {
        if (res) return res;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

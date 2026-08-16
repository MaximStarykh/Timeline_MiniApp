// Простий офлайн-кеш: статика кешується під час встановлення,
// запити виконуються за схемою cache-first із фоновим оновленням.
const CACHE = 'timeline-v2';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './game-engine.js',
  './events.js',
  './storage.js',
  './telegram.js',
  './config.js',
  './leaderboard.js',
  './manifest.json',
  './fonts/manrope-cyrillic.woff2',
  './fonts/manrope-cyrillic-ext.woff2',
  './fonts/manrope-latin.woff2',
  './images/cards/category-state.webp',
  './images/cards/category-culture.webp',
  './images/cards/category-science.webp',
  './images/cards/category-society.webp',
  './images/cards/category-resistance.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? refresh;
    }),
  );
});

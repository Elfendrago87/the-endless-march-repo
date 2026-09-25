// Offline cache for the installed (home screen) version of the game.
const CACHE = 'endless-march-v0.6.0';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './js/util.js', './js/data.js', './js/audio.js', './js/input.js', './js/world.js', './js/fx.js',
  './js/player.js', './js/enemies.js', './js/projectiles.js', './js/waves.js', './js/game.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first, network as a fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

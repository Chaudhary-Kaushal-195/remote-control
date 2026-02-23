const CACHE_NAME = 'dr-control-v15'; // Pixel-perfect needles & centered cluster
const ASSETS = [
  'index.html',
  'controller.html',
  'manifest.json',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
  'https://unpkg.com/html5-qrcode',
  'engine.mp3'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  // Network First strategy
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

const CACHE_NAME = 'dr-vice-hub-v2';
const ASSETS = [
    './',
    './pages/index.html',
    './pages/cargame.html',
    './pages/controller.html',
    './css/index.css',
    './css/cargame.css',
    './css/controller.css',
    './javascript/index.js',
    './javascript/cargame-scene.js',
    './javascript/cargame-controls.js',
    './javascript/cargame-hud.js',
    './javascript/controller.js',
    './manifest.json',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Network First, falling back to cache
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

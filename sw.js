const CACHE_NAME = 'dr-vice-hub-v2';
const ASSETS = [
    './',
    'pages/index.html',
    'pages/cargame.html',
    'pages/controller.html',
    'css/index.css',
    'css/cargame.css',
    'css/controller.css',
    'javascript/index.js',
    'javascript/cargame-hud.js',
    'javascript/cargame/ui-manager.js',
    'javascript/cargame/peer-connection.js',
    'javascript/cargame/input-manager.js',
    'javascript/cargame/environment.js',
    'javascript/cargame/car-physics.js',
    'javascript/controller/connection.js',
    'javascript/controller/sensors.js',
    'javascript/controller/touch-controls.js',
    'typescript/audio-engine/dist/assets/engine-audio.js',
    'manifest.json',
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

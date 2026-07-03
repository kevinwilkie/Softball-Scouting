/* Service worker: network-first for the app shell so updates always reach the
   device when online, with a cache fallback so it still works at the field with
   no signal. */
const CACHE = 'chs-scout-v30';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase-config.js',
  './sync.js',
  './manifest.json',
  './icon.svg?v=21'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Let cross-origin requests (e.g. Firebase SDK on gstatic) go straight to the
  // network — don't cache or intercept them.
  if (url.origin !== self.location.origin) return;

  // Network-first: always try the network so the newest files win, and fall
  // back to the cached copy only when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});

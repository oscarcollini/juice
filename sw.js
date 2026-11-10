const cacheName = 'juice-shell-v06';
const shell = ['./', './index.html', './style.css?v=6', './app.js?v=6', './manifest.webmanifest?v=6', './icon-192.png?v=6', './icon-512.png?v=6'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('juice-shell-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = self.registration.scope;
  if (event.request.method !== 'GET' || !url.href.startsWith(scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then(cache => cache.match('./index.html'))));
  } else if (shell.some(path => new URL(path, scope).href === url.href)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
  }
});

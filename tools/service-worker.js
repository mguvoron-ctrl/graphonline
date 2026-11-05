// Build injects a versioned list of local, public application resources.
const CACHE = 'graphonline-__VERSION__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  const freshAssets = ASSETS.map(url => new Request(url, {cache: 'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(freshAssets)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('graphonline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/backend/') || url.pathname.includes('/admin')) return;
  const shell = /^\/(?:bg|ch|cs|de|el|en|es|fr|nl|pl|pt|sv|ua)?\/?$/.test(url.pathname);
  if (event.request.mode === 'navigate' && shell) {
    // Only a public shell is stored; never cache a query-specific graph response.
    event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname).then(response => response || caches.match('/'))));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(response => response || fetch(event.request)));
  }
});

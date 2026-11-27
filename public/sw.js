const shellCache = 'fitness-next-shell-v1';
const shellPath = '/';
const assets = ['/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png',
  '/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png'];

function isAsset(url) {
  return url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/') ||
      assets.includes(url.pathname));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.addAll([shellPath, ...assets]))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('fitness-next-shell-') && key !== shellCache)
      .map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', (event) => {
  if (!Array.isArray(event.data?.assets)) return;
  const urls = event.data.assets.slice(0, 200)
    .filter((value) => typeof value === 'string' && value.startsWith(self.location.origin + '/'))
    .map((value) => new URL(value)).filter(isAsset);
  event.waitUntil(caches.open(shellCache).then((cache) =>
    Promise.allSettled(urls.map((url) => cache.add(url.href)))));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === shellPath) {
    event.respondWith(caches.open(shellCache).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put(shellPath, response.clone());
        }
        return response;
      } catch {
        return await cache.match(shellPath) ?? Response.error();
      }
    }));
  } else if (isAsset(url)) {
    event.respondWith(caches.open(shellCache).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});

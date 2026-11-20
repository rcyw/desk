const cachePrefix = 'desk-pwa-';
const shellCache = cachePrefix + 'shell-v1';
const pageCache = cachePrefix + 'pages-v1';
const assetCache = cachePrefix + 'assets-v1';
const offlinePath = '/offline.html';
const pagePath =
  /^(?:\/$|\/page\/\d+\/?$|\/topics(?:\/|$)|\/posts\/|\/brief(?:\/|$))/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(shellCache);
      await cache.add(new Request(offlinePath, { cache: 'reload' }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = [shellCache, pageCache, assetCache];
      for (const name of await caches.keys()) {
        if (name.startsWith(cachePrefix) && !current.includes(name)) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

async function remember(cacheName, request, response, limit) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const entries = await cache.keys();
  await Promise.all(
    entries
      .slice(0, Math.max(0, entries.length - limit))
      .map((entry) => cache.delete(entry)),
  );
}

async function readPage(event) {
  const { request } = event;
  let response;
  try {
    response = await fetch(request, { cache: 'no-cache' });
  } catch {
    const cached = await caches.match(request, { cacheName: pageCache });
    if (cached) return cached;
    const offline = await caches.match(offlinePath, { cacheName: shellCache });
    if (!offline) return Response.error();
    return new Response(offline.body, {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (
    response.status === 200 &&
    response.headers.get('content-type')?.startsWith('text/html')
  ) {
    event.waitUntil(
      remember(pageCache, request, response.clone(), 40).catch(() => {}),
    );
  } else if (response.status === 404 || response.status === 410) {
    event.waitUntil(
      caches
        .open(pageCache)
        .then((cache) => cache.delete(request))
        .catch(() => {}),
    );
  }
  return response;
}

async function readAsset(event) {
  const { request } = event;
  const cached = await caches
    .match(request, { cacheName: assetCache })
    .catch(() => undefined);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    event.waitUntil(
      remember(assetCache, request, response.clone(), 160).catch(() => {}),
    );
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const { origin, pathname } = new URL(request.url);
  if (origin !== self.location.origin) return;

  if (
    pagePath.test(pathname) &&
    (request.mode === 'navigate' || !request.destination)
  ) {
    event.respondWith(readPage(event));
  } else if (pathname.startsWith('/_astro/') && !request.headers.has('range')) {
    event.respondWith(readAsset(event));
  }
});

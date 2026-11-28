/* global deskShell */
const scope = new URL(self.registration.scope);
const cachePrefix = 'desk-pwa:' + scope.pathname + ':';
const shellCache = cachePrefix + 'shell-' + deskShell.revision;
const pageCache = cachePrefix + 'pages-v2';
const assetCache = cachePrefix + 'assets-v1';
const offlinePath = new URL('offline.html', scope).href;
const shellAssets = new Set(
  deskShell.paths
    .filter((path) => !path.endsWith('/'))
    .map((path) => new URL(path, scope).pathname),
);
const pagePath = /^\/(?:$|(?:blog|brief|papers|prompts|github)(?:\/|$))/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(shellCache);
      await cache.addAll(
        deskShell.paths.map(
          (path) =>
            new Request(new URL(path, scope), {
              cache: path.startsWith('_astro/') ? 'force-cache' : 'reload',
            }),
        ),
      );
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
    // The pinned launcher always has a matching set of styles and scripts.
    const launchPage = await caches.match(request, {
      cacheName: shellCache,
      ignoreSearch: true,
    });
    if (launchPage) return launchPage;
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
  if (origin !== scope.origin || !pathname.startsWith(scope.pathname)) return;
  const localPath = '/' + pathname.slice(scope.pathname.length);

  if (
    pagePath.test(localPath) &&
    (request.mode === 'navigate' || !request.destination)
  ) {
    event.respondWith(readPage(event));
  } else if (shellAssets.has(pathname) && !request.headers.has('range')) {
    // Static shell files have one representation, including for CORS font and module loads.
    event.respondWith(
      caches
        .match(request, {
          cacheName: shellCache,
          ignoreVary: true,
          ignoreSearch: true,
        })
        .then((cached) => cached ?? fetch(request)),
    );
  } else if (
    localPath.startsWith('/_astro/') &&
    !request.headers.has('range')
  ) {
    event.respondWith(readAsset(event));
  }
});

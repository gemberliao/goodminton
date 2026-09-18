const CACHE_PREFIX = 'goodminton-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkRequest = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });

      return cached || networkRequest;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { title: 'GOODMINTON', body: event.data?.text() || '你有一則新的球隊通知。' };
  }

  const title = payload.title || 'GOODMINTON';
  const iconUrl = new URL('./icon-192.png', self.registration.scope).href;
  const badgeUrl = new URL('./icon-maskable-512.png', self.registration.scope).href;
  const unreadCount = Number(payload.unreadCount || 1);

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: iconUrl,
      badge: badgeUrl,
      tag: payload.tag || 'goodminton-notification',
      renotify: true,
      timestamp: payload.timestamp || Date.now(),
      data: {
        notificationId: payload.notificationId,
        url: payload.url || '#/member/dashboard'
      }
    }),
    self.navigator.setAppBadge ? self.navigator.setAppBadge(unreadCount) : Promise.resolve()
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationId = event.notification.data?.notificationId;
  const route = event.notification.data?.url || '#/member/dashboard';
  const targetUrl = new URL('./', self.registration.scope);
  if (notificationId) targetUrl.searchParams.set('notification', notificationId);
  targetUrl.hash = route.startsWith('#') ? route.slice(1) : route;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === targetUrl.origin);
      if (existing) {
        await existing.navigate(targetUrl.href);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl.href);
    })
  );
});

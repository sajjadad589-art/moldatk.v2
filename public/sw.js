const CACHE_NAME = 'moldatk-shell-v4-1.3.30';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy))); }
      return response;
    })));
    return;
  }

  if (request.mode === 'navigate' || url.pathname === '/app-version.json' || url.pathname === '/sw.js') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
      if (response.ok && request.mode === 'navigate') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/', copy));
      }
      return response;
    }).catch(() => request.mode === 'navigate' ? caches.match('/') : caches.match(request)));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data ? event.data.text() : '' }; }
  const title = payload.title || 'مولدتك';
  const options = { body: payload.body || 'لديك إشعار جديد', icon: '/icons/moldatk-icon-192-v6.png', badge: '/icons/moldatk-icon-192-v6.png', dir: 'rtl', lang: 'ar', tag: payload.notification_id || undefined, renotify: true, data: { url: payload.url || '/', notification_id: payload.notification_id || null } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});

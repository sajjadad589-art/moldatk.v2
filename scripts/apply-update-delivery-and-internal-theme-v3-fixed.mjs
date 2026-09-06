import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// Android updater: query both Supabase and the static manifest, then pick the highest version code.
{
  const path = 'src/components/AndroidUpdateChecker.tsx';
  let src = read(path);
  const start = src.indexOf('      let latestManifest: VersionManifest | null = null;');
  const endMarker = '      const installedCode = Number(version.versionCode);';
  const end = src.indexOf(endMarker);
  if (start !== -1 && end !== -1 && end > start) {
    const replacement = `      const candidates: VersionManifest[] = [];

      try {
        const release = await loadActiveRelease();
        if (release) {
          const fromDb: VersionManifest = {
            enabled: true,
            versionCode: Number(release.version_code),
            versionName: release.version_name,
            force: Boolean(release.is_mandatory),
            minimumVersionCode: release.is_mandatory ? Number(release.version_code) : 0,
            apkUrl: release.apk_url,
            notes: release.release_notes,
          };
          if (Number.isFinite(Number(fromDb.versionCode)) && Number(fromDb.versionCode) > 0) candidates.push(fromDb);
        }
      } catch {}

      try {
        const response = await fetch('/app-version.json?ts=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (response.ok) {
          const staticManifest = await response.json() as VersionManifest;
          if (staticManifest?.enabled && Number.isFinite(Number(staticManifest.versionCode)) && Number(staticManifest.versionCode) > 0) candidates.push(staticManifest);
        }
      } catch {}

      if (!candidates.length) throw new Error('تعذر التحقق من آخر إصدار');
      const latestManifest = candidates.sort((a, b) => Number(b.versionCode) - Number(a.versionCode))[0];

`;
    src = src.slice(0, start) + replacement + src.slice(end);
  }
  src = src.replace('const timer = window.setTimeout(() => void install(true), 900);', 'const timer = window.setTimeout(() => void install(true), 700);');
  write(path, src);
}

// Default internal UI to the approved calm light theme; user can still switch to dark mode.
{
  const path = 'src/App.tsx';
  let src = read(path);
  src = src.replace('const [darkMode, setDarkMode] = useState<boolean>(true);', 'const [darkMode, setDarkMode] = useState<boolean>(false);');
  write(path, src);
}

// Strong internal visual layer without touching payment-status colors.
{
  const path = 'src/index.css';
  let src = read(path);
  const marker = '/* MOLDATK_INTERNAL_CALM_THEME_V3 */';
  if (!src.includes(marker)) {
    src += '\n\n' + marker + `
:root{--moldatk-navy:#0B1F3B;--moldatk-navy-2:#142A45;--moldatk-gold:#F2B544;--moldatk-gold-deep:#D89A21;--moldatk-page:#F7F9FC;--moldatk-border:#DDE5EC;}
html:not(.dark) body{background:#F7F9FC;color:#0B1F3B;}
html:not(.dark) [class~="bg-[#1E3A8A]"]{background-color:#0B1F3B!important;}
html:not(.dark) [class~="bg-blue-600"],html:not(.dark) [class~="bg-blue-700"],html:not(.dark) [class~="bg-blue-800"]{background-color:#0B1F3B!important;}
html:not(.dark) [class~="text-blue-600"],html:not(.dark) [class~="text-blue-700"],html:not(.dark) [class~="text-blue-800"],html:not(.dark) [class~="text-[#1E3A8A]"]{color:#0B1F3B!important;}
html:not(.dark) [class~="border-blue-600"],html:not(.dark) [class~="border-blue-700"],html:not(.dark) [class~="border-blue-800"]{border-color:#D89A21!important;}
html:not(.dark) [class~="hover:bg-blue-700"]:hover,html:not(.dark) [class~="hover:bg-blue-800"]:hover,html:not(.dark) [class~="hover:bg-blue-900"]:hover{background-color:#142A45!important;}
html:not(.dark) input:focus,html:not(.dark) select:focus,html:not(.dark) textarea:focus{border-color:#D89A21!important;box-shadow:0 0 0 2px rgba(242,181,68,.22)!important;}
`;
  }
  write(path, src);
}

// Browser/PWA: network-first for HTML/JS/CSS/version manifest and reload open clients when a new worker activates.
write('public/sw.js', `const CACHE_NAME = 'moldatk-shell-v4-1.3.17';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try { await client.navigate(client.url); } catch (_) {}
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname === '/app-version.json' || url.pathname === '/sw.js' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
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
  const options = { body: payload.body || 'لديك إشعار جديد', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', dir: 'rtl', lang: 'ar', tag: payload.notification_id || undefined, renotify: true, data: { url: payload.url || '/', notification_id: payload.notification_id || null } };
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
`);

// Ask the browser to bypass cache when checking the worker and to re-check it every minute.
{
  const path = 'src/main.tsx';
  let src = read(path);
  src = src.replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register('/sw.js?v=1.3.17', { updateViaCache: 'none' })");
  if (!src.includes('registration.update();')) {
    src = src.replace(
      "navigator.serviceWorker.register('/sw.js?v=1.3.17', { updateViaCache: 'none' }).catch(error => {",
      "navigator.serviceWorker.register('/sw.js?v=1.3.17', { updateViaCache: 'none' }).then(registration => {\n      void registration.update();\n      window.setInterval(() => void registration.update(), 60 * 1000);\n    }).catch(error => {"
    );
  }
  write(path, src);
}

console.log('Applied reliable Android/browser update delivery and enforced the internal calm theme.');

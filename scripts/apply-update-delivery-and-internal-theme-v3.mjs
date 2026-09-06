import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// 1) Android updater: always compare Supabase release and static manifest and use the newest one.
write('src/components/AndroidUpdateChecker.tsx', `import React, { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Download, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { loadActiveRelease } from '../lib/siteManagement';

type VersionManifest = {
  enabled: boolean;
  versionCode: number;
  versionName: string;
  minimumVersionCode?: number;
  force?: boolean;
  apkUrl?: string;
  notes?: string;
};

type AppUpdaterPlugin = {
  getVersionInfo(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(options: { url: string }): Promise<{ launched: boolean }>;
};

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');
const AUTO_UPDATE_KEY_PREFIX = 'moldatk_auto_update_started_';

const validManifest = (m: VersionManifest | null | undefined) => Boolean(m?.enabled && Number.isFinite(Number(m.versionCode)) && Number(m.versionCode) > 0);

export const AndroidUpdateChecker: React.FC = () => {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [currentVersionCode, setCurrentVersionCode] = useState<number | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState('');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const autoStartedRef = useRef<number | null>(null);

  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const checkForUpdates = async () => {
    if (!isAndroidNative) return;
    setChecking(true);
    setError(null);
    try {
      const version = await AppUpdater.getVersionInfo();
      const candidates: VersionManifest[] = [];

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
          if (validManifest(fromDb)) candidates.push(fromDb);
        }
      } catch {}

      try {
        const response = await fetch('/app-version.json?ts=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (response.ok) {
          const staticManifest = await response.json() as VersionManifest;
          if (validManifest(staticManifest)) candidates.push(staticManifest);
        }
      } catch {}

      if (!candidates.length) throw new Error('تعذر التحقق من آخر إصدار');
      const latestManifest = candidates.sort((a, b) => Number(b.versionCode) - Number(a.versionCode))[0];
      const installedCode = Number(version.versionCode);

      setCurrentVersionCode(installedCode);
      setCurrentVersionName(version.versionName || '');
      setManifest(latestManifest);
      setDismissed(false);

      if (!latestManifest.enabled || Number(latestManifest.versionCode) <= installedCode) {
        setShowUpToDate(true);
        window.setTimeout(() => setShowUpToDate(false), 3200);
      }
    } catch (e: any) {
      setError(e?.message || 'تعذر التحقق من التحديث');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isAndroidNative) return;
    void checkForUpdates();
    const onVisible = () => {
      if (document.visibilityState === 'visible') window.setTimeout(() => void checkForUpdates(), 500);
    };
    const periodic = window.setInterval(() => void checkForUpdates(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(periodic);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAndroidNative]);

  if (!isAndroidNative) return null;

  const hasUpdate = Boolean(manifest?.enabled && currentVersionCode !== null && Number(manifest.versionCode) > currentVersionCode);
  const forceUpdate = Boolean(hasUpdate && (manifest?.force || currentVersionCode! < Number(manifest?.minimumVersionCode || 0)));

  const install = async (automatic = false) => {
    if (!manifest?.apkUrl) {
      setError('رابط ملف التحديث غير مفعّل بعد');
      return;
    }
    const targetCode = Number(manifest.versionCode);
    if (automatic && autoStartedRef.current === targetCode) return;
    if (automatic) autoStartedRef.current = targetCode;
    setInstalling(true);
    setError(null);
    try {
      const result = await AppUpdater.downloadAndInstall({ url: manifest.apkUrl });
      if (result?.launched) {
        try { localStorage.setItem(\`${AUTO_UPDATE_KEY_PREFIX}\${targetCode}\`, new Date().toISOString()); } catch {}
      }
    } catch (e: any) {
      const message = e?.message || 'تعذر تنزيل التحديث';
      setError(message);
      if (message.includes('اسمح للتطبيق')) autoStartedRef.current = null;
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    if (!hasUpdate || !manifest?.apkUrl || installing || checking) return;
    const targetCode = Number(manifest.versionCode);
    if (autoStartedRef.current === targetCode) return;
    const timer = window.setTimeout(() => void install(true), 700);
    return () => window.clearTimeout(timer);
  }, [hasUpdate, manifest?.versionCode, manifest?.apkUrl, installing, checking]);

  if (dismissed && !forceUpdate) return null;
  if (!checking && !installing && !error && !hasUpdate && !showUpToDate) return null;

  return (
    <div className="fixed z-[9999] left-3 right-3 bottom-[76px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[430px]" dir="rtl">
      <div className="rounded-2xl border border-[#DDE5EC] dark:border-slate-700 bg-white/97 dark:bg-[#102139]/97 backdrop-blur-xl shadow-xl px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className={\`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 \${error ? 'bg-rose-50 text-rose-600' : hasUpdate ? 'bg-[#FFF6DE] text-[#C88709]' : 'bg-emerald-50 text-emerald-600'}\`}>
            {checking || installing ? <RefreshCw className="w-5 h-5 animate-spin" /> : error ? <AlertTriangle className="w-5 h-5" /> : hasUpdate ? <Download className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-[#0B1F3B] dark:text-white">
              {checking ? 'جاري التحقق من التحديثات...' : installing ? 'جاري تنزيل التحديث تلقائياً...' : error ? 'تعذر التحديث التلقائي' : hasUpdate ? \`تحديث \${manifest?.versionName || ''} متوفر\` : 'أنت تستخدم أحدث إصدار'}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {error || (hasUpdate ? (manifest?.notes || \`الإصدار الحالي \${currentVersionName || currentVersionCode}\`) : \`الإصدار الحالي \${currentVersionName || currentVersionCode || ''}\`)}
            </div>
          </div>
          {hasUpdate && !installing && (
            <button type="button" onClick={() => void install(false)} className="shrink-0 rounded-xl bg-[#0B1F3B] hover:bg-[#142A45] text-white px-3 py-2 text-[11px] font-black">تحديث الآن</button>
          )}
          {!forceUpdate && !checking && !installing && (
            <button type="button" onClick={() => setDismissed(true)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق إشعار التحديث"><X className="w-4 h-4" /></button>
          )}
        </div>
        {(checking || installing) && <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full w-2/3 rounded-full bg-[#D89A21] animate-pulse" /></div>}
        {forceUpdate && <div className="mt-2 text-[10px] font-bold text-[#B57600]">هذا التحديث مطلوب للاستمرار باستخدام التطبيق.</div>}
      </div>
    </div>
  );
};
`);

// 2) Default internal UI to the approved calm/light identity. Dark mode is still available from the UI.
{
  const path = 'src/App.tsx';
  let src = read(path);
  src = src.replace('const [darkMode, setDarkMode] = useState<boolean>(true);', 'const [darkMode, setDarkMode] = useState<boolean>(false);');
  write(path, src);
}

// 3) Persistent internal visual layer. Business-state colors (paid/unpaid/partial/free) remain untouched.
{
  const path = 'src/index.css';
  let src = read(path);
  const marker = '/* MOLDATK_INTERNAL_CALM_THEME_V3 */';
  if (!src.includes(marker)) {
    src += `\n\n${marker}\n:root{--moldatk-navy:#0B1F3B;--moldatk-navy-2:#142A45;--moldatk-gold:#F2B544;--moldatk-gold-deep:#D89A21;--moldatk-page:#F7F9FC;--moldatk-border:#DDE5EC;}\nhtml:not(.dark) body{background:#F7F9FC;color:#0B1F3B;}\nhtml:not(.dark) [class~="bg-[#1E3A8A]"]{background-color:#0B1F3B!important;}\nhtml:not(.dark) [class~="bg-blue-600"],html:not(.dark) [class~="bg-blue-700"],html:not(.dark) [class~="bg-blue-800"]{background-color:#0B1F3B!important;}\nhtml:not(.dark) [class~="text-blue-600"],html:not(.dark) [class~="text-blue-700"],html:not(.dark) [class~="text-blue-800"],html:not(.dark) [class~="text-[#1E3A8A]"]{color:#0B1F3B!important;}\nhtml:not(.dark) [class~="border-blue-600"],html:not(.dark) [class~="border-blue-700"],html:not(.dark) [class~="border-blue-800"]{border-color:#D89A21!important;}\nhtml:not(.dark) [class~="hover:bg-blue-700"]:hover,html:not(.dark) [class~="hover:bg-blue-800"]:hover,html:not(.dark) [class~="hover:bg-blue-900"]:hover{background-color:#142A45!important;}\nhtml:not(.dark) input:focus,html:not(.dark) select:focus,html:not(.dark) textarea:focus{border-color:#D89A21!important;box-shadow:0 0 0 2px rgba(242,181,68,.22)!important;}\n`;
  }
  write(path, src);
}

// 4) Service worker: network-first assets, immediate activation, and reload open browser clients once a new worker activates.
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
      if ('focus' in client) { if ('navigate' in client) await client.navigate(targetUrl); return client.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});
`);

// 5) Ask the browser to check the service worker frequently and bypass HTTP cache.
{
  const path = 'src/main.tsx';
  let src = read(path);
  const oldBlock = `if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {\n  window.addEventListener('load', () => {\n    navigator.serviceWorker.register('/sw.js').catch(error => {\n      console.warn('PWA service worker registration failed:', error);\n    });\n  });\n}`;
  const newBlock = `if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {\n  window.addEventListener('load', () => {\n    navigator.serviceWorker.register('/sw.js?v=1.3.17', { updateViaCache: 'none' }).then(registration => {\n      void registration.update();\n      window.setInterval(() => void registration.update(), 60 * 1000);\n    }).catch(error => {\n      console.warn('PWA service worker registration failed:', error);\n    });\n  });\n}`;
  if (src.includes(oldBlock)) src = src.replace(oldBlock, newBlock);
  else src = src.replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register('/sw.js?v=1.3.17', { updateViaCache: 'none' })");
  write(path, src);
}

console.log('Applied update delivery v3: newest Android manifest wins, browser cache self-refreshes, and internal calm theme is enforced.');

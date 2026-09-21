import React, { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Download, RefreshCw, AlertTriangle } from 'lucide-react';
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
const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/sajjadad589-art/moldatk.v2/main/public/app-version.json';
const WEB_MANIFEST_URL = 'https://moldatk-v2-beta.vercel.app/app-version.json';
const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const AUTO_UPDATE_COOLDOWN_MS = 2 * 60 * 1000;

export const AndroidUpdateChecker: React.FC = () => {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [currentVersionCode, setCurrentVersionCode] = useState<number | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState('');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStartedRef = useRef<number | null>(null);
  const checkInFlightRef = useRef(false);

  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const wasAutoStartedRecently = (targetCode: number) => {
    try {
      const raw = localStorage.getItem(`${AUTO_UPDATE_KEY_PREFIX}${targetCode}`);
      if (!raw) return false;
      const startedAt = Date.parse(raw);
      return Number.isFinite(startedAt) && Date.now() - startedAt < AUTO_UPDATE_COOLDOWN_MS;
    } catch {
      return false;
    }
  };

  const rememberAutoStart = (targetCode: number) => {
    try { localStorage.setItem(`${AUTO_UPDATE_KEY_PREFIX}${targetCode}`, new Date().toISOString()); } catch {}
  };

  const clearCompletedUpdateMarkers = (installedCode: number) => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith(AUTO_UPDATE_KEY_PREFIX)) continue;
        const code = Number(key.slice(AUTO_UPDATE_KEY_PREFIX.length));
        if (Number.isFinite(code) && code <= installedCode) localStorage.removeItem(key);
      }
    } catch {}
  };

  const checkForUpdates = async () => {
    if (!isAndroidNative || checkInFlightRef.current) return;

    checkInFlightRef.current = true;
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
          if (Number.isFinite(Number(fromDb.versionCode)) && Number(fromDb.versionCode) > 0) candidates.push(fromDb);
        }
      } catch {}

      // Use two independent internet manifests plus the bundled copy. Every request has a
      // cache-buster so SUNMI/Android WebView/CDNs cannot keep an old release decision.
      const manifestUrls = [REMOTE_MANIFEST_URL, WEB_MANIFEST_URL, '/app-version.json'];
      for (const manifestUrl of manifestUrls) {
        try {
          const separator = manifestUrl.includes('?') ? '&' : '?';
          const response = await fetch(manifestUrl + separator + 'ts=' + Date.now(), {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          });
          if (!response.ok) continue;
          const candidate = await response.json() as VersionManifest;
          if (candidate?.enabled && Number.isFinite(Number(candidate.versionCode)) && Number(candidate.versionCode) > 0) {
            candidates.push(candidate);
          }
        } catch {}
      }

      if (!candidates.length) throw new Error('تعذر التحقق من آخر إصدار');
      const latestManifest = candidates.sort((a, b) => Number(b.versionCode) - Number(a.versionCode))[0];

      const installedCode = Number(version.versionCode);
      clearCompletedUpdateMarkers(installedCode);
      setCurrentVersionCode(installedCode);
      setCurrentVersionName(version.versionName || '');
      setManifest(latestManifest);

      if (!latestManifest.enabled || Number(latestManifest.versionCode) <= installedCode) {
        autoStartedRef.current = null;
      }
    } catch (e: any) {
      // Background checks stay silent. If an update is already known, keep its card visible
      // and preserve any install-related message only when relevant.
      if (manifest && currentVersionCode !== null && Number(manifest.versionCode) > currentVersionCode) {
        console.warn('Background update check failed:', e);
      }
    } finally {
      checkInFlightRef.current = false;
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isAndroidNative) return;

    let resumeTimer = 0;
    const triggerFastCheck = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => void checkForUpdates(), 250);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') triggerFastCheck();
    };

    void checkForUpdates();
    const periodic = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', triggerFastCheck);
    window.addEventListener('online', triggerFastCheck);

    return () => {
      window.clearInterval(periodic);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', triggerFastCheck);
      window.removeEventListener('online', triggerFastCheck);
      window.clearTimeout(resumeTimer);
    };
  }, [isAndroidNative]);

  if (!isAndroidNative) return null;

  const hasUpdate = Boolean(manifest?.enabled && currentVersionCode !== null && Number(manifest.versionCode) > currentVersionCode);
  const forceUpdate = Boolean(hasUpdate && (manifest?.force || currentVersionCode! < Number(manifest?.minimumVersionCode || 0)));

  const install = async (automatic = false) => {
    if (!manifest?.apkUrl || installing) {
      if (!manifest?.apkUrl) setError('رابط ملف التحديث غير مفعّل بعد');
      return;
    }

    const targetCode = Number(manifest.versionCode);
    if (automatic && (autoStartedRef.current === targetCode || wasAutoStartedRecently(targetCode))) return;
    if (automatic) {
      autoStartedRef.current = targetCode;
      // Persist before starting the native download so app resume/remount cannot start it again.
      rememberAutoStart(targetCode);
    }

    setInstalling(true);
    setError(null);
    try {
      const result = await AppUpdater.downloadAndInstall({ url: manifest.apkUrl });
      if (result?.launched) rememberAutoStart(targetCode);
    } catch (e: any) {
      const message = e?.message || 'تعذر تنزيل التحديث';
      setError(message);
      // Permission flow is the only case where automatic retry after returning is useful.
      if (message.includes('اسمح للتطبيق')) {
        autoStartedRef.current = null;
        try { localStorage.removeItem(`${AUTO_UPDATE_KEY_PREFIX}${targetCode}`); } catch {}
      }
    } finally {
      setInstalling(false);
    }
  };

  // UPDATE_NOTICE_BACKGROUND_V2
  // Do not auto-launch the Android installer. Checks are silent and the update card
  // remains visible until the installed version catches up or the user taps "تحديث الآن".

  if (!hasUpdate && !installing) return null;

  const waitingForInstall = Boolean(hasUpdate && manifest && wasAutoStartedRecently(Number(manifest.versionCode)) && !installing && !error);

  return (
    <div className="fixed z-[9999] left-3 right-3 bottom-[76px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[430px]" dir="rtl">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${error ? 'bg-rose-50 text-rose-600' : hasUpdate ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {installing ? <RefreshCw className="w-5 h-5 animate-spin" /> : error ? <AlertTriangle className="w-5 h-5" /> : <Download className="w-5 h-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-slate-900 dark:text-white">
              {installing ? 'جاري تنزيل التحديث...' : error ? 'تعذر التحديث' : waitingForInstall ? 'التحديث جاهز للتثبيت' : `تحديث ${manifest?.versionName || ''} متوفر`}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {error || (waitingForInstall ? 'إذا أغلقت شاشة تثبيت أندرويد، اضغط تحديث الآن لإعادة فتحها.' : (manifest?.notes || `الإصدار الحالي ${currentVersionName || currentVersionCode}`))}
            </div>
          </div>

          {hasUpdate && !installing && (
            <button type="button" onClick={() => void install(false)} className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-[11px] font-black">
              تحديث الآن
            </button>
          )}

        </div>

        {installing && (
          <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-blue-600 animate-pulse" />
          </div>
        )}

        {forceUpdate && <div className="mt-2 text-[10px] font-bold text-amber-600">هذا التحديث مطلوب للاستمرار باستخدام التطبيق.</div>}
      </div>
    </div>
  );
};

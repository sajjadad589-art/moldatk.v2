import React, { useEffect, useRef, useState } from 'react';
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
      let latestManifest: VersionManifest | null = null;

      try {
        const release = await loadActiveRelease();
        if (release) {
          latestManifest = {
            enabled: true,
            versionCode: Number(release.version_code),
            versionName: release.version_name,
            force: Boolean(release.is_mandatory),
            minimumVersionCode: release.is_mandatory ? Number(release.version_code) : 0,
            apkUrl: release.apk_url,
            notes: release.release_notes,
          };
        }
      } catch {
        // Supabase unavailable: use the static manifest as a safe fallback.
      }

      if (!latestManifest) {
        const response = await fetch('/app-version.json?ts=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('تعذر التحقق من آخر إصدار');
        latestManifest = await response.json() as VersionManifest;
      }

      const installedCode = Number(version.versionCode);
      setCurrentVersionCode(installedCode);
      setCurrentVersionName(version.versionName || '');
      setManifest(latestManifest);

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
      if (document.visibilityState === 'visible') {
        window.setTimeout(() => void checkForUpdates(), 700);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
        try { localStorage.setItem(`${AUTO_UPDATE_KEY_PREFIX}${targetCode}`, new Date().toISOString()); } catch {}
      }
    } catch (e: any) {
      const message = e?.message || 'تعذر تنزيل التحديث';
      setError(message);
      // إذا فتح Android صفحة السماح بالتثبيت، اسمح بإعادة المحاولة تلقائياً عند الرجوع للتطبيق.
      if (message.includes('اسمح للتطبيق')) autoStartedRef.current = null;
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    if (!hasUpdate || !manifest?.apkUrl || installing || checking) return;
    const targetCode = Number(manifest.versionCode);
    if (autoStartedRef.current === targetCode) return;

    // يبدأ تنزيل التحديث تلقائياً بمجرد اكتشاف إصدار أحدث.
    const timer = window.setTimeout(() => void install(true), 900);
    return () => window.clearTimeout(timer);
  }, [hasUpdate, manifest?.versionCode, manifest?.apkUrl, installing, checking]);

  if (dismissed && !forceUpdate) return null;
  if (!checking && !installing && !error && !hasUpdate && !showUpToDate) return null;

  return (
    <div className="fixed z-[9999] left-3 right-3 bottom-[76px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[430px]" dir="rtl">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${error ? 'bg-rose-50 text-rose-600' : hasUpdate ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {checking || installing ? <RefreshCw className="w-5 h-5 animate-spin" /> : error ? <AlertTriangle className="w-5 h-5" /> : hasUpdate ? <Download className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-slate-900 dark:text-white">
              {checking ? 'جاري التحقق من التحديثات...' : installing ? 'جاري تنزيل التحديث تلقائياً...' : error ? 'تعذر التحديث التلقائي' : hasUpdate ? `تحديث ${manifest?.versionName || ''} متوفر` : 'أنت تستخدم أحدث إصدار'}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {error || (hasUpdate ? (manifest?.notes || `الإصدار الحالي ${currentVersionName || currentVersionCode}`) : `الإصدار الحالي ${currentVersionName || currentVersionCode || ''}`)}
            </div>
          </div>

          {hasUpdate && !installing && (
            <button type="button" onClick={() => void install(false)} className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-[11px] font-black">
              تحديث الآن
            </button>
          )}

          {!forceUpdate && !checking && !installing && (
            <button type="button" onClick={() => setDismissed(true)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق إشعار التحديث">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(checking || installing) && (
          <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-blue-600 animate-pulse" />
          </div>
        )}

        {forceUpdate && <div className="mt-2 text-[10px] font-bold text-amber-600">هذا التحديث مطلوب للاستمرار باستخدام التطبيق.</div>}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
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

export const AndroidUpdateChecker: React.FC = () => {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [currentVersionCode, setCurrentVersionCode] = useState<number | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState('');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showUpToDate, setShowUpToDate] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;
    const run = async () => {
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
          // Keep the static manifest as a safe fallback.
        }

        if (!latestManifest) {
          const response = await fetch('/app-version.json?ts=' + Date.now(), { cache: 'no-store' });
          if (!response.ok) throw new Error('تعذر التحقق من آخر إصدار');
          latestManifest = await response.json() as VersionManifest;
        }

        if (cancelled) return;
        const installedCode = Number(version.versionCode);
        setCurrentVersionCode(installedCode);
        setCurrentVersionName(version.versionName || '');
        setManifest(latestManifest);

        if (!latestManifest.enabled || Number(latestManifest.versionCode) <= installedCode) {
          setShowUpToDate(true);
          window.setTimeout(() => {
            if (!cancelled) setShowUpToDate(false);
          }, 3200);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'تعذر التحقق من التحديث');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, []);

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;

  const hasUpdate = Boolean(manifest?.enabled && currentVersionCode !== null && Number(manifest.versionCode) > currentVersionCode);
  const forceUpdate = Boolean(hasUpdate && (manifest?.force || currentVersionCode! < Number(manifest?.minimumVersionCode || 0)));

  const install = async () => {
    if (!manifest?.apkUrl) {
      setError('رابط ملف التحديث غير مفعّل بعد');
      return;
    }
    setInstalling(true);
    setError(null);
    try {
      await AppUpdater.downloadAndInstall({ url: manifest.apkUrl });
    } catch (e: any) {
      setError(e?.message || 'تعذر تنزيل التحديث');
    } finally {
      setInstalling(false);
    }
  };

  if (dismissed && !forceUpdate) return null;
  if (!checking && !error && !hasUpdate && !showUpToDate) return null;

  return (
    <div className="fixed z-[9999] left-3 right-3 bottom-[76px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[430px]" dir="rtl">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${error ? 'bg-rose-50 text-rose-600' : hasUpdate ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : error ? <AlertTriangle className="w-5 h-5" /> : hasUpdate ? <Download className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-slate-900 dark:text-white">
              {checking ? 'جاري التحقق من التحديثات...' : error ? 'تعذر التحقق من التحديث' : hasUpdate ? `تحديث ${manifest?.versionName || ''} متوفر` : 'أنت تستخدم أحدث إصدار'}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {error || (hasUpdate ? (manifest?.notes || `الإصدار الحالي ${currentVersionName || currentVersionCode}`) : `الإصدار الحالي ${currentVersionName || currentVersionCode || ''}`)}
            </div>
          </div>

          {hasUpdate && (
            <button type="button" onClick={() => void install()} disabled={installing} className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-2 text-[11px] font-black">
              {installing ? 'جاري...' : 'تحديث'}
            </button>
          )}

          {!forceUpdate && !checking && (
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

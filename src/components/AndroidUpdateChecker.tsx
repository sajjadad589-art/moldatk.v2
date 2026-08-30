import React, { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

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
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;
    const run = async () => {
      setChecking(true);
      try {
        const [version, response] = await Promise.all([
          AppUpdater.getVersionInfo(),
          fetch('/app-version.json?ts=' + Date.now(), { cache: 'no-store' }),
        ]);
        if (!response.ok) throw new Error('تعذر التحقق من آخر إصدار');
        const latest = await response.json() as VersionManifest;
        if (cancelled) return;
        setCurrentVersionCode(Number(version.versionCode));
        setManifest(latest);
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
  if (checking || !manifest || currentVersionCode === null || !manifest.enabled) return null;

  const hasUpdate = Number(manifest.versionCode) > currentVersionCode;
  if (!hasUpdate) return null;

  const forceUpdate = Boolean(manifest.force) || currentVersionCode < Number(manifest.minimumVersionCode || 0);
  if (dismissed && !forceUpdate) return null;

  const install = async () => {
    if (!manifest.apkUrl) {
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

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl">↻</div>
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">يوجد تحديث جديد</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            الإصدار {manifest.versionName} متوفر الآن
          </p>
        </div>

        {manifest.notes && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300 text-right">
            {manifest.notes}
          </div>
        )}

        {error && <div className="text-xs font-bold text-rose-600">{error}</div>}

        <button
          onClick={install}
          disabled={installing}
          className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 font-black text-sm"
        >
          {installing ? 'جاري تنزيل التحديث...' : 'تنزيل وتحديث التطبيق'}
        </button>

        {!forceUpdate && (
          <button
            onClick={() => setDismissed(true)}
            className="w-full rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-2.5 font-bold text-xs"
          >
            لاحقاً
          </button>
        )}

        {forceUpdate && (
          <p className="text-[11px] font-bold text-amber-600">هذا التحديث مطلوب للاستمرار باستخدام التطبيق.</p>
        )}
      </div>
    </div>
  );
};

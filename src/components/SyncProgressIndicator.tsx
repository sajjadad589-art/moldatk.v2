import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';

type SyncDetail = {
  active?: boolean;
  progress?: number;
  message?: string;
  pending?: boolean;
};

type StatusState = {
  online: boolean;
  syncing: boolean;
  progress: number;
  pending: boolean;
};

export const SyncProgressIndicator: React.FC = () => {
  const [state, setState] = useState<StatusState>(() => ({
    online: Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true),
    syncing: false,
    progress: 0,
    pending: false,
  }));
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resolveTarget = () => setPortalTarget(document.getElementById('moldatk-sync-status-slot'));
    resolveTarget();
    const timer = window.setInterval(resolveTarget, 400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let settleTimer: number | undefined;

    const markOnline = () => {
      setState(current => ({ ...current, online: true, pending: false }));
    };

    const markOffline = () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      setState({ online: false, syncing: false, progress: 0, pending: true });
    };

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<SyncDetail>).detail || {};
      if (settleTimer) window.clearTimeout(settleTimer);

      const online = Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true);
      const progress = Math.max(0, Math.min(100, Number(detail.progress || 0)));
      const syncing = Boolean(detail.active) || (online && progress > 0 && progress < 100);
      const pending = Capacitor.isNativePlatform() ? false : (Boolean(detail.pending) || !online);

      setState({ online, syncing, progress, pending });

      const staleTimer = window.setTimeout(() => {
        setState(current => current.syncing || current.pending
          ? { online: Capacitor.isNativePlatform() ? true : current.online, syncing: false, progress: 0, pending: false }
          : current);
      }, 8000);
      settleTimer = staleTimer;

      if (online && !pending && progress >= 100) {
        settleTimer = window.setTimeout(() => {
          setState({ online: true, syncing: false, progress: 0, pending: false });
        }, 900);
      }
    };

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    window.addEventListener('moldatk-sync-progress', onSync as EventListener);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('moldatk-sync-progress', onSync as EventListener);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, []);

  const completed = state.online && !state.pending && state.progress >= 100;
  const label = !state.online
    ? 'غير متصل بالإنترنت'
    : state.syncing || completed
      ? `جاري المزامنة ${Math.max(1, state.progress)}%`
      : state.pending
        ? 'بانتظار المزامنة'
        : 'متصل بالإنترنت';

  const tone = !state.online
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/80 dark:text-red-300'
    : state.syncing || completed
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/80 dark:text-blue-300'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/80 dark:text-emerald-300';

  const dotTone = !state.online
    ? 'bg-red-500'
    : state.syncing || completed
      ? 'bg-blue-500 animate-pulse'
      : 'bg-emerald-500';

  const badge = (
    <div
      dir="rtl"
      className={`max-w-[calc(100vw-24px)] rounded-full border px-3 py-1.5 shadow-sm backdrop-blur text-[10px] sm:text-[11px] font-black flex items-center gap-1.5 ${tone}`}
      style={{ pointerEvents: 'none' }}
      aria-live="polite"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotTone}`} />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
  if (portalTarget) return createPortal(badge, portalTarget);
  return null;
};

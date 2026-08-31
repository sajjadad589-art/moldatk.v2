import React, { useEffect, useState } from 'react';

type SyncDetail = {
  active?: boolean;
  progress?: number;
  message?: string;
  pending?: boolean;
};

export const SyncProgressIndicator: React.FC = () => {
  const [state, setState] = useState({ active: false, progress: 0, message: '', pending: false });

  useEffect(() => {
    let hideTimer: number | undefined;
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<SyncDetail>).detail || {};
      if (hideTimer) window.clearTimeout(hideTimer);
      const progress = Math.max(0, Math.min(100, Number(detail.progress || 0)));
      setState({
        active: Boolean(detail.active),
        progress,
        message: detail.message || (detail.pending ? 'بانتظار الاتصال للمزامنة' : 'جاري المزامنة'),
        pending: Boolean(detail.pending),
      });
      if (!detail.active && !detail.pending && progress >= 100) {
        hideTimer = window.setTimeout(() => setState(s => ({ ...s, active: false, message: '' })), 1400);
      }
    };
    window.addEventListener('moldatk-sync-progress', onSync as EventListener);
    return () => {
      window.removeEventListener('moldatk-sync-progress', onSync as EventListener);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!state.active && !state.pending && !state.message) return null;

  return (
    <div
      dir="rtl"
      className="fixed z-[160] left-1/2 -translate-x-1/2 bottom-3 w-[min(92vw,360px)] rounded-xl border border-slate-200 bg-white/95 dark:bg-slate-950/95 dark:border-slate-700 shadow-lg px-3 py-2 backdrop-blur"
      style={{ pointerEvents: 'none' }}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5">
        <span className="truncate">{state.message || 'جاري المزامنة'}</span>
        <span>{state.pending ? '—' : `${state.progress}%`}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${state.pending ? 18 : state.progress}%` }}
        />
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, HardDrive, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type StorageStats = {
  plan: string;
  database_bytes: number;
  database_quota_bytes: number;
  database_percent: number;
  file_storage_bytes: number;
  file_storage_quota_bytes: number;
  file_storage_percent: number;
  object_count: number;
  critical_percent: number;
  critical_resource: 'database' | 'files';
  level: 'healthy' | 'warning' | 'danger' | 'full';
  sampled_at: string;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit >= 3 ? 2 : unit >= 2 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
};

const levelText: Record<StorageStats['level'], string> = {
  healthy: 'المساحة بحالة جيدة',
  warning: 'تنبيه: المساحة تقترب من الحد',
  danger: 'تحذير: المساحة شبه ممتلئة',
  full: 'خطر: تم بلوغ حد التخزين',
};

export const SuperAdminStorageCard: React.FC = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke('super-admin-storage-stats', { body: {} });
    if (invokeError || !data?.ok) {
      setError(data?.error || invokeError?.message || 'تعذر قراءة مساحة Supabase');
    } else {
      setStats(data as StorageStats);
      setError(null);
    }
    if (!quiet) setLoading(false);
  }, []);

  useEffect(() => {
    void loadStats();
    const timer = window.setInterval(() => void loadStats(true), 20000);
    const onFocus = () => void loadStats(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadStats]);

  const visual = useMemo(() => {
    const percent = Math.min(100, Math.max(0, stats?.critical_percent || 0));
    const circumference = 2 * Math.PI * 52;
    const offset = circumference * (1 - percent / 100);
    const stroke = !stats || stats.level === 'healthy' ? '#059669' : stats.level === 'warning' ? '#d97706' : '#dc2626';
    return { percent, circumference, offset, stroke };
  }, [stats]);

  return (
    <section className="mb-5 bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm min-w-0 overflow-hidden">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-start justify-between gap-4 xl:gap-6 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 min-w-0">
            <div>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <HardDrive className="w-5 h-5 text-blue-700" />
                <h2 className="text-sm sm:text-base font-black leading-6 break-words">مساحة التخزين في Supabase</h2>
                {stats && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black uppercase">{stats.plan}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">قراءة مباشرة تتحدث تلقائياً كل 20 ثانية، وعند الرجوع للنافذة.</p>
            </div>
            <button onClick={() => void loadStats()} disabled={loading} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50" title="تحديث الآن">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Database className="w-4 h-4 text-blue-700" /><span className="text-xs font-black text-slate-600">قاعدة البيانات</span></div>
                <span className="text-sm font-black">{stats ? `${stats.database_percent.toFixed(1)}%` : '—'}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${Math.min(100, stats?.database_percent || 0)}%` }} /></div>
              <p className="text-xs text-slate-500 mt-2">{stats ? `${formatBytes(stats.database_bytes)} من ${formatBytes(stats.database_quota_bytes)}` : 'جاري القراءة...'}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-emerald-700" /><span className="text-xs font-black text-slate-600">الملفات</span></div>
                <span className="text-sm font-black">{stats ? `${stats.file_storage_percent.toFixed(1)}%` : '—'}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, stats?.file_storage_percent || 0)}%` }} /></div>
              <p className="text-xs text-slate-500 mt-2">{stats ? `${formatBytes(stats.file_storage_bytes)} من ${formatBytes(stats.file_storage_quota_bytes)} • ${stats.object_count} ملف` : 'جاري القراءة...'}</p>
            </div>
          </div>

          {stats && (
            <div className={`mt-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 border ${stats.level === 'healthy' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : stats.level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="flex items-center gap-2 font-black text-sm">
                {stats.level === 'healthy' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span>{levelText[stats.level]}</span>
              </div>
              <span className="text-[11px] font-bold opacity-80">آخر قراءة: {new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { timeStyle: 'medium' }).format(new Date(stats.sampled_at))}</span>
            </div>
          )}
        </div>

        <div className="w-full xl:w-40 shrink-0 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={visual.stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={visual.circumference} strokeDashoffset={visual.offset} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black">{stats ? `${visual.percent.toFixed(1)}%` : '—'}</span>
              <span className="text-[10px] font-bold text-slate-500 mt-1">نسبة الامتلاء</span>
            </div>
          </div>
          <p className="text-[11px] text-center text-slate-500 font-bold mt-2">تعتمد على المورد الأقرب للامتلاء</p>
        </div>
      </div>
    </section>
  );
};

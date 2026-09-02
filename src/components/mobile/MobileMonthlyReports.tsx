import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp, WalletCards } from 'lucide-react';
import type { Subscriber } from '../../types';
import { buildMonthlyReports } from '../../utils/monthlyAccounting';
import { formatCurrency } from '../../utils/formatters';

interface MobileMonthlyReportsProps {
  subscribers: Subscriber[];
  currency: string;
}

const Ring: React.FC<{ value: number; total: number; label: string; tone: 'green' | 'red' }> = ({ value, total, label, tone }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const stroke = tone === 'green' ? '#10b981' : '#f43f5e';
  const dash = `${pct} ${100 - pct}`;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="3" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray={dash} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black tabular-nums">{value}</span>
          <span className="text-[9px] text-slate-400">مشترك</span>
        </div>
      </div>
      <span className={`text-[11px] font-black ${tone === 'green' ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</span>
    </div>
  );
};

export const MobileMonthlyReports: React.FC<MobileMonthlyReportsProps> = ({ subscribers, currency }) => {
  const reports = useMemo(() => buildMonthlyReports(subscribers), [subscribers]);
  const [expanded, setExpanded] = useState<string | null>(reports[0]?.monthId || null);

  if (!reports.length) {
    return (
      <div className="p-4 pb-24">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101b35] p-8 text-center space-y-3">
          <CalendarRange className="w-10 h-10 mx-auto text-blue-400" />
          <h2 className="text-sm font-black">تقارير الأشهر السابقة</h2>
          <p className="text-xs text-slate-400 leading-6">ماكو فواتير شهرية محفوظة بعد. أول ما تنحفظ دفعات الأشهر راح تظهر التقارير هنا تلقائياً.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 pb-24 space-y-3" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">تقارير الأشهر</h2>
          <p className="text-[11px] text-slate-400 mt-1">المسددين، غير المسددين، مجموع الشهر والديون المرحّلة</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-600/15 text-blue-400 flex items-center justify-center">
          <CalendarRange className="w-5 h-5" />
        </div>
      </div>

      {reports.map(report => {
        const totalPeople = Math.max(1, report.paidCount + report.unpaidCount);
        const isOpen = expanded === report.monthId;
        return (
          <section key={report.monthId} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1730] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : report.monthId)}
              className="w-full flex items-center justify-between p-4 text-right"
            >
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">{report.monthNameAr}</div>
                <div className="text-[10px] text-slate-400 mt-1">{report.monthId}</div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 rounded-3xl bg-slate-50 dark:bg-[#111c38] p-4">
                <Ring value={report.paidCount} total={totalPeople} label="المسددين" tone="green" />
                <Ring value={report.unpaidCount} total={totalPeople} label="غير المسددين" tone="red" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="rounded-2xl bg-blue-600/10 border border-blue-500/20 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400">
                    <WalletCards className="w-4 h-4" />
                    <span className="text-xs font-black">المبلغ الكلي للشهر</span>
                  </div>
                  <strong className="text-sm tabular-nums text-slate-900 dark:text-white">{formatCurrency(report.totalAmount, currency)}</strong>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400">المبلغ المستحصل</span>
                  <strong className="text-sm tabular-nums text-emerald-400">{formatCurrency(report.paidAmount, currency)}</strong>
                </div>
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 flex items-center justify-between">
                  <span className="text-xs font-black text-rose-400">الديون المتبقية</span>
                  <strong className="text-sm tabular-nums text-rose-400">{formatCurrency(report.debtAmount, currency)}</strong>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-black text-slate-500 dark:text-slate-300">ديون المشتركين لهذا الشهر</h3>
                  {report.subscriberDebts.length === 0 ? (
                    <div className="rounded-2xl bg-emerald-500/10 text-emerald-400 text-xs font-bold p-3 text-center">ماكو ديون متبقية لهذا الشهر</div>
                  ) : report.subscriberDebts.map(item => (
                    <div key={`${report.monthId}-${item.subscriberId}`} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-[#111c38] p-3 border border-slate-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{item.code}</div>
                      </div>
                      <div className="text-xs font-black text-rose-400 tabular-nums">{formatCurrency(item.debt, currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

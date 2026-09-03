import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Users,
  Zap,
  WalletCards,
  CircleDollarSign,
  HandCoins,
  ShieldCheck,
} from 'lucide-react';
import type { MonthlyTariffRecord, Subscriber } from '../../types';
import { buildMonthlyReports, type MonthlyReport } from '../../utils/monthlyAccounting';
import { formatCurrency, formatNumberArabic } from '../../utils/formatters';

interface MobileMonthlyReportsProps {
  subscribers: Subscriber[];
  currency: string;
  monthlyTariffs?: MonthlyTariffRecord[];
}

const emptyReportFromTariff = (tariff: MonthlyTariffRecord): MonthlyReport => ({
  monthId: tariff.id,
  monthNameAr: tariff.monthNameAr || `${tariff.month}/${tariff.year}`,
  totalAmount: 0,
  paidAmount: 0,
  debtAmount: 0,
  totalSubscribers: 0,
  totalAmperes: 0,
  paidCount: 0,
  partialCount: 0,
  unpaidCount: 0,
  freeCount: 0,
  carriedDebtOut: 0,
  subscribers: [],
  paidSubscribers: [],
  partialSubscribers: [],
  unpaidSubscribers: [],
  freeSubscribers: [],
  subscriberDebts: [],
});

const monthShort = (monthId: string) => {
  const [year, month] = monthId.split('-');
  return `${Number(month)}/${year}`;
};

const Ring: React.FC<{
  value: number;
  total: number;
  tone: 'green' | 'red';
}> = ({ value, total, tone }) => {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const stroke = tone === 'green' ? '#22c55e' : '#ef4444';
  const circumference = 251.2;
  const offset = circumference - (circumference * pct) / 100;

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(100,116,139,.28)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={stroke}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-white tabular-nums leading-none">{formatNumberArabic(value)}</span>
        <span className="mt-1 text-[10px] font-bold text-slate-400">مشترك</span>
      </div>
    </div>
  );
};

export const MobileMonthlyReports: React.FC<MobileMonthlyReportsProps> = ({
  subscribers,
  currency,
  monthlyTariffs = [],
}) => {
  const reports = useMemo(() => {
    const map = new Map<string, MonthlyReport>();
    for (const report of buildMonthlyReports(subscribers)) map.set(report.monthId, report);
    for (const tariff of monthlyTariffs) {
      if (!map.has(tariff.id)) map.set(tariff.id, emptyReportFromTariff(tariff));
    }
    return [...map.values()].sort((a, b) => b.monthId.localeCompare(a.monthId));
  }, [subscribers, monthlyTariffs]);

  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => reports[0]?.monthId || '');
  const [openList, setOpenList] = useState<'paid' | 'outstanding' | null>(null);

  const selectedIndex = Math.max(0, reports.findIndex(r => r.monthId === selectedMonthId));
  const selected = reports[selectedIndex] || reports[0];

  React.useEffect(() => {
    if (!reports.length) return;
    if (!reports.some(r => r.monthId === selectedMonthId)) setSelectedMonthId(reports[0].monthId);
  }, [reports, selectedMonthId]);

  if (!reports.length || !selected) {
    return (
      <div className="p-4 pb-24">
        <div className="rounded-3xl border border-slate-800 bg-[#101b35] p-8 text-center space-y-3">
          <CalendarRange className="w-10 h-10 mx-auto text-blue-400" />
          <h2 className="text-sm font-black text-white">التقارير الشهرية</h2>
          <p className="text-xs text-slate-400 leading-6">أول ما تنحفظ تسعيرة شهرية وفواتير المشتركين راح يظهر أرشيف الشهر هنا تلقائياً.</p>
        </div>
      </div>
    );
  }

  const newer = selectedIndex > 0 ? reports[selectedIndex - 1] : null;
  const older = selectedIndex < reports.length - 1 ? reports[selectedIndex + 1] : null;
  const outstandingCount = selected.unpaidCount + selected.partialCount;
  const outstandingList = [...selected.partialSubscribers, ...selected.unpaidSubscribers]
    .sort((a, b) => b.remaining - a.remaining);
  const selectedList = openList === 'paid' ? selected.paidSubscribers : openList === 'outstanding' ? outstandingList : [];

  const selectMonth = (id: string) => {
    setSelectedMonthId(id);
    setOpenList(null);
  };

  return (
    <div className="p-3.5 pb-24 space-y-3.5" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black text-white">التقارير</h2>
          <p className="text-[11px] text-slate-400 mt-1">أرشيف كل شهر يبقى ثابت حتى بعد إضافة تسعيرة الشهر التالي</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-600/15 text-blue-400 flex items-center justify-center">
          <CalendarRange className="w-5 h-5" />
        </div>
      </div>

      {/* Month slider: older on the left, selected in the middle, newer on the right. */}
      <div dir="ltr" className="grid grid-cols-[1fr_1.25fr_1fr] items-center gap-1 rounded-2xl bg-[#111c38] border border-slate-800 p-1.5">
        <button
          type="button"
          disabled={!older}
          onClick={() => older && selectMonth(older.monthId)}
          className="min-w-0 h-12 rounded-xl flex items-center justify-center gap-1 text-sm font-black text-slate-200 disabled:opacity-25"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="truncate">{older ? monthShort(older.monthId) : '—'}</span>
        </button>

        <div className="h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2 px-2 shadow-md shadow-blue-900/30">
          <CalendarRange className="w-4 h-4" />
          <span className="text-base font-black tabular-nums">{monthShort(selected.monthId)}</span>
        </div>

        <button
          type="button"
          disabled={!newer}
          onClick={() => newer && selectMonth(newer.monthId)}
          className="min-w-0 h-12 rounded-xl flex items-center justify-center gap-1 text-sm font-black text-slate-200 disabled:opacity-25"
        >
          <span className="truncate">{newer ? monthShort(newer.monthId) : '—'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-center text-[11px] font-bold text-slate-400">
        البيانات المعروضة تخص <span className="text-blue-400 font-black">{selected.monthNameAr}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-3xl bg-[#111c38] border border-blue-900/60 p-4 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">عدد المشتركين</span>
            <strong className="text-2xl font-black text-white tabular-nums">{formatNumberArabic(selected.totalSubscribers)}</strong>
          </div>
          <Users className="w-7 h-7 text-blue-400" />
        </div>
        <div className="rounded-3xl bg-[#111c38] border border-cyan-900/60 p-4 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">عدد الأمبيرات</span>
            <strong className="text-2xl font-black text-cyan-300 tabular-nums">{formatNumberArabic(selected.totalAmperes)}</strong>
          </div>
          <Zap className="w-7 h-7 text-cyan-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setOpenList(openList === 'paid' ? null : 'paid')}
          className={`rounded-3xl bg-[#111c38] border p-3.5 transition-all ${openList === 'paid' ? 'border-emerald-400 ring-2 ring-emerald-500/15' : 'border-emerald-900/60'}`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">تم التسديد</span>
          </div>
          <Ring value={selected.paidCount} total={Math.max(1, selected.totalSubscribers)} tone="green" />
          <div className="mt-2 pt-2 border-t border-slate-800 text-center">
            <span className="block text-[9px] text-slate-400">المبلغ المستحصل</span>
            <strong className="block text-sm font-black text-emerald-400 tabular-nums" dir="ltr">{formatCurrency(selected.paidAmount, currency)}</strong>
            <span className="block text-[9px] text-slate-500 mt-1">اضغط لعرض المسددين</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setOpenList(openList === 'outstanding' ? null : 'outstanding')}
          className={`rounded-3xl bg-[#111c38] border p-3.5 transition-all ${openList === 'outstanding' ? 'border-rose-400 ring-2 ring-rose-500/15' : 'border-rose-900/60'}`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black text-rose-400">مستحق التسديد</span>
          </div>
          <Ring value={outstandingCount} total={Math.max(1, selected.totalSubscribers)} tone="red" />
          <div className="mt-2 pt-2 border-t border-slate-800 text-center">
            <span className="block text-[9px] text-slate-400">المبلغ المتبقي</span>
            <strong className="block text-sm font-black text-rose-400 tabular-nums" dir="ltr">{formatCurrency(selected.debtAmount, currency)}</strong>
            <span className="block text-[9px] text-slate-500 mt-1">اضغط لعرض المطلوبين</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-200/80 block">مسدد جزئياً</span>
            <strong className="text-lg font-black text-amber-400">{formatNumberArabic(selected.partialCount)}</strong>
          </div>
          <HandCoins className="w-5 h-5 text-amber-400" />
        </div>
        <div className="rounded-2xl bg-slate-500/10 border border-slate-500/25 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-300 block">مجاني / إعفاء</span>
            <strong className="text-lg font-black text-slate-300">{formatNumberArabic(selected.freeCount)}</strong>
          </div>
          <ShieldCheck className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-l from-blue-950/80 to-[#111c38] border border-blue-800/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-300">
            <WalletCards className="w-5 h-5" />
            <span className="text-xs font-black">المبلغ الكلي لهذا الشهر</span>
          </div>
          <strong className="text-lg font-black text-white tabular-nums" dir="ltr">{formatCurrency(selected.totalAmount, currency)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-blue-900/50 pt-3">
          <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
            <span className="text-[9px] text-emerald-300 block">المستحصل</span>
            <strong className="text-xs font-black text-emerald-400" dir="ltr">{formatCurrency(selected.paidAmount, currency)}</strong>
          </div>
          <div className="rounded-xl bg-rose-500/10 px-3 py-2">
            <span className="text-[9px] text-rose-300 block">المرحل للشهر التالي</span>
            <strong className="text-xs font-black text-rose-400" dir="ltr">{formatCurrency(selected.carriedDebtOut, currency)}</strong>
          </div>
        </div>
      </div>

      {openList && (
        <section className="rounded-3xl bg-[#0d1730] border border-slate-800 overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {openList === 'paid' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <h3 className={`text-xs font-black ${openList === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {openList === 'paid' ? 'المسددون في هذا الشهر' : 'غير المسددين / المسددون جزئياً'}
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">{formatNumberArabic(selectedList.length)} مشترك</span>
          </div>

          <div className="p-2.5 space-y-2 max-h-[360px] overflow-y-auto">
            {selectedList.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-500">لا توجد أسماء ضمن هذه الحالة لهذا الشهر</div>
            ) : selectedList.map(item => (
              <div key={`${selected.monthId}-${openList}-${item.subscriberId}`} className="rounded-2xl bg-[#111c38] border border-slate-800 px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">{item.name}</div>
                  <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-2">
                    <span className="font-mono">{item.code}</span>
                    <span>•</span>
                    <span>{formatNumberArabic(item.amperes)} أمبير</span>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className={`block text-xs font-black ${openList === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                    {formatCurrency(openList === 'paid' ? item.paid : item.remaining, currency)}
                  </span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">
                    {item.status === 'partial' ? 'جزئي' : item.status === 'paid' ? 'مسدد' : 'مطلوب'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 flex items-start gap-2 text-[10px] leading-5 text-slate-400">
        <Layers3 className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
        <span>كل شهر يعتمد على فواتيره وتسعيرته المحفوظة لذلك الشهر؛ تغيير تسعيرة شهر جديد ما يغيّر أرقام الأشهر السابقة.</span>
      </div>
    </div>
  );
};

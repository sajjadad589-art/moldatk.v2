import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Zap,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, LineDistribution } from '../../types';
import { formatCurrency, formatNumberArabic } from '../../utils/formatters';

interface MobileDashboardProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  onOpenPricingModal: () => void;
  onOpenNewSubscriberModal: () => void;
  onNavigateToTab: (tab: string) => void;
}

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  subscribers,
  pricingTiers,
  generatorSpecs,
  lines,
  onOpenPricingModal,
  onOpenNewSubscriberModal,
  onNavigateToTab,
}) => {
  const totalSubscribers = subscribers.length;
  const paidSubs = subscribers.filter(s => s.paymentStatus === 'paid');
  const unpaidSubs = subscribers.filter(s => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial');

  const totalCollectedRevenue = paidSubs.reduce(
    (acc, s) => acc + (Number(s.amountPaid) || 0),
    0
  );
  const totalUnpaidDebt = unpaidSubs.reduce((acc, s) => {
    const due = Number(s.amountDue) || 0;
    const paid = Number(s.amountPaid) || 0;
    return acc + Math.max(0, due - paid);
  }, 0);

  const totalAmperesLoad = subscribers.reduce((acc, s) => acc + s.amperes, 0);
  const totalNormalAmps = subscribers.filter(s => s.tier === 'normal').reduce((acc, s) => acc + s.amperes, 0);
  const totalCommercialAmps = subscribers.filter(s => s.tier === 'commercial').reduce((acc, s) => acc + s.amperes, 0);
  const totalGoldenAmps = subscribers.filter(s => s.tier === 'golden').reduce((acc, s) => acc + s.amperes, 0);

  const circleLength = 251.2;
  const paidOffset = circleLength - (circleLength * Math.min(paidSubs.length, totalSubscribers)) / (totalSubscribers || 1);
  const unpaidOffset = circleLength - (circleLength * Math.min(unpaidSubs.length, totalSubscribers)) / (totalSubscribers || 1);

  return (
    <div className="p-3.5 space-y-3.5 max-w-lg mx-auto">
      {/* 1. Quick Action Header Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenNewSubscriberModal}
          className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-600 active:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مشترك جديد</span>
        </button>

        <button
          onClick={onOpenPricingModal}
          className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#111c38] active:bg-slate-100 dark:active:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700/80 shadow-sm transition-all cursor-pointer"
        >
          <DollarSign className="w-4 h-4 text-emerald-500" />
          <span>تسعيرة الأمبير</span>
        </button>
      </div>

      {/* 2. Paid / Unpaid collection wheels */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">حالة تسديد المشتركين</h2>
          <span className="text-[10px] font-bold text-slate-400">إجمالي {formatNumberArabic(totalSubscribers)} مشترك</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateToTab('subscribers')}
            className="min-w-0 rounded-3xl bg-white dark:bg-[#111c38] border border-emerald-200/80 dark:border-emerald-900/60 p-3.5 shadow-sm active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-black text-slate-900 dark:text-white">المسددين</span>
            </div>

            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="10" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-emerald-500 transition-all duration-500"
                  strokeWidth="10"
                  strokeDasharray={circleLength}
                  strokeDashoffset={paidOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" dir="ltr">
                <span className="text-3xl font-black text-emerald-500 tabular-nums leading-none">{formatNumberArabic(paidSubs.length)}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">مشترك</span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-[9px] font-bold text-slate-400 mb-0.5">المبلغ المستحصل</span>
              <span className="block text-sm font-black text-emerald-500 tabular-nums truncate" dir="ltr">
                {formatCurrency(totalCollectedRevenue)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('subscribers')}
            className="min-w-0 rounded-3xl bg-white dark:bg-[#111c38] border border-rose-200/80 dark:border-rose-900/60 p-3.5 shadow-sm active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-black text-slate-900 dark:text-white">غير المسددين</span>
            </div>

            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="10" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-rose-500 transition-all duration-500"
                  strokeWidth="10"
                  strokeDasharray={circleLength}
                  strokeDashoffset={unpaidOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" dir="ltr">
                <span className="text-3xl font-black text-rose-500 tabular-nums leading-none">{formatNumberArabic(unpaidSubs.length)}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">مشترك</span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-[9px] font-bold text-slate-400 mb-0.5">المبلغ غير المسدد</span>
              <span className="block text-sm font-black text-rose-500 tabular-nums truncate" dir="ltr">
                {formatCurrency(totalUnpaidDebt)}
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 3. Active Electrical Load Summary Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">الأحمال وتوزيع الأمبيرات</h3>
              <span className="text-[10px] text-slate-400">إجمالي الطاقة المشترك بها</span>
            </div>
          </div>

          <div className="text-left">
            <span className="text-base font-black text-blue-700 dark:text-blue-400 tabular-nums">
              {formatNumberArabic(totalAmperesLoad)} A
            </span>
            <span className="text-[10px] text-slate-400 block">من سعة {generatorSpecs.maxAmperes}A</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center">
          <div>
            <span className="text-[10px] text-slate-400 block">سكني عادي</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
              {formatNumberArabic(totalNormalAmps)} A
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">تجاري</span>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
              {formatNumberArabic(totalCommercialAmps)} A
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">ذهبي VIP</span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
              {formatNumberArabic(totalGoldenAmps)} A
            </span>
          </div>
        </div>
      </div>

      {/* 4. Distribution Lines Quick Status */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">خطوط التوزيع والقواطع الرئيسية</h3>
          <button
            onClick={() => onNavigateToTab('settings')}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            <span>التفاصيل</span>
            <ChevronLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {lines.slice(0, 3).map(line => {
            const loadPercent = Math.min(100, Math.round((line.currentLoadAmperes / line.maxCapacityAmperes) * 100));
            return (
              <div key={line.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-200 truncate">{line.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] tabular-nums">
                    {formatNumberArabic(line.currentLoadAmperes)} / {formatNumberArabic(line.maxCapacityAmperes)} A
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      loadPercent > 90
                        ? 'bg-rose-500'
                        : loadPercent > 75
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

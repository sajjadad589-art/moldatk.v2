import React from 'react';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  HeartHandshake,
  DollarSign,
  Zap,
  Sliders,
  Plus,
  ArrowRight,
  TrendingUp,
  Fuel,
  Activity,
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
  const unpaidSubs = subscribers.filter(s => s.paymentStatus === 'unpaid');
  const freeSubs = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free');

  const totalCollectedRevenue = paidSubs.reduce(
    (acc, s) => acc + (s.amountPaid || s.amountDue),
    0
  );
  const totalUnpaidDebt = unpaidSubs.reduce((acc, s) => acc + s.amountDue, 0);
  const totalExpectedRevenue = totalCollectedRevenue + totalUnpaidDebt;
  const collectionRate =
    totalExpectedRevenue > 0
      ? Math.round((totalCollectedRevenue / totalExpectedRevenue) * 100)
      : 0;

  const totalAmperesLoad = subscribers.reduce((acc, s) => acc + s.amperes, 0);
  const totalNormalAmps = subscribers.filter(s => s.tier === 'normal').reduce((acc, s) => acc + s.amperes, 0);
  const totalCommercialAmps = subscribers.filter(s => s.tier === 'commercial').reduce((acc, s) => acc + s.amperes, 0);
  const totalGoldenAmps = subscribers.filter(s => s.tier === 'golden').reduce((acc, s) => acc + s.amperes, 0);

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

      {/* 2. Primary Financial Collection Card */}
      <div className="bg-gradient-to-br from-[#1E3A8A] to-indigo-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-blue-800/80 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200">ملخص الإيرادات الشهرية</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 border border-emerald-400/30">
              نسبة التحصيل: {formatNumberArabic(collectionRate)}%
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-white tabular-nums tracking-tight">
                {formatCurrency(totalCollectedRevenue)}
              </span>
              <span className="text-xs text-blue-200 block mt-0.5">تم تحصيله من المسددين</span>
            </div>
            <div className="text-left">
              <span className="text-base font-bold text-rose-300 tabular-nums">
                {formatCurrency(totalUnpaidDebt)}
              </span>
              <span className="text-[11px] text-rose-200/80 block mt-0.5">ذمة غير مسددة</span>
            </div>
          </div>

          {/* Collection Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-blue-300 font-medium">
              <span>المجموع المتوقع: {formatCurrency(totalExpectedRevenue)}</span>
              <span>{formatNumberArabic(paidSubs.length)} من {formatNumberArabic(totalSubscribers)} مشترك مسدد</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Triple Status Bento Cards (Paid, Unpaid, Free) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Paid Card */}
        <div
          onClick={() => onNavigateToTab('subscribers')}
          className="p-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 text-center cursor-pointer active:scale-98 transition-all shadow-xs"
        >
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-semibold">المسددون</span>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
            {formatNumberArabic(paidSubs.length)}
          </span>
          <span className="text-[9px] text-slate-400 block truncate">
            {formatCurrency(totalCollectedRevenue)}
          </span>
        </div>

        {/* Unpaid Card */}
        <div
          onClick={() => onNavigateToTab('subscribers')}
          className="p-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 text-center cursor-pointer active:scale-98 transition-all shadow-xs"
        >
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-semibold">غير المسددين</span>
          <span className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
            {formatNumberArabic(unpaidSubs.length)}
          </span>
          <span className="text-[9px] text-slate-400 block truncate">
            {formatCurrency(totalUnpaidDebt)}
          </span>
        </div>

        {/* Free Card */}
        <div
          onClick={() => onNavigateToTab('subscribers')}
          className="p-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 text-center cursor-pointer active:scale-98 transition-all shadow-xs"
        >
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-semibold">إعفاء مجاني</span>
          <span className="text-base font-black text-purple-600 dark:text-purple-400 tabular-nums block mt-0.5">
            {formatNumberArabic(freeSubs.length)}
          </span>
          <span className="text-[9px] text-slate-400 block truncate">
            إنساني ومساجد
          </span>
        </div>
      </div>

      {/* 4. Active Electrical Load Summary Card */}
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

        {/* Breakdown by Tier */}
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

      {/* 5. Distribution Lines Quick Status */}
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

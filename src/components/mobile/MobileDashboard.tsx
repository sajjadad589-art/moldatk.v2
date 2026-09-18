// WORKMODE_DASHBOARD_STATUS_FILTER
import { MobileAdSlider } from './MobileAdSlider';
import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Plus,
  Wallet,
  ChevronLeft,
  CircleDollarSign,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, LineDistribution } from '../../types';
import { calculateSubscriberBill, formatCurrency, formatNumberArabic } from '../../utils/formatters';
import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';
import { getAmpereDiscountDashboardSummary } from '../../utils/discountAccounting';
import { summarizeSubscribers } from '../../utils/authoritativeAccounting';

interface MobileDashboardProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  onOpenPricingModal: () => void;
  onOpenNewSubscriberModal: () => void;
  onNavigateToTab: (tab: string) => void;
  cashboxAmount?: number;
  activeMonthId?: string;
}

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  subscribers,
  pricingTiers,
  generatorSpecs,
  lines,
  onOpenPricingModal,
  onOpenNewSubscriberModal,
  onNavigateToTab,
  cashboxAmount = 0,
  activeMonthId = getMonthId(),
}) => {
  const [showPreviousDebtList, setShowPreviousDebtList] = useState(false);
  const ampereDiscountSummary = getAmpereDiscountDashboardSummary(subscribers, pricingTiers, activeMonthId);
  // AUTHORITATIVE_FINANCE_V2
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const dashboardRowById = new Map(dashboardSummary.rows.map(row => [row.sub.id, row] as const));
  const isPaidThisMonth = (sub: Subscriber) => {
    const row = dashboardRowById.get(sub.id);
    return Boolean(row && row.status === 'paid' && row.outstanding === 0 && row.bill > 0);
  };
  const isUnpaidThisMonth = (sub: Subscriber) => {
    const row = dashboardRowById.get(sub.id);
    return Boolean(row && (row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'));
  };
  const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];
  const unpaidSubs = billingCycleActive ? subscribers.filter(isUnpaidThisMonth) : [];
  const totalSubscribers = paidSubs.length + unpaidSubs.length;
  const totalCollectedRevenue = billingCycleActive ? dashboardSummary.collected : 0;
  const totalUnpaidDebt = billingCycleActive ? dashboardSummary.outstanding : 0;
  const currentMonthTotal = billingCycleActive ? dashboardSummary.monthTotal : 0;

  const circleLength = 251.2;
  const paidOffset = circleLength - (circleLength * Math.min(paidSubs.length, totalSubscribers)) / (totalSubscribers || 1);
  const unpaidOffset = circleLength - (circleLength * Math.min(unpaidSubs.length, totalSubscribers)) / (totalSubscribers || 1);

  return (
    <div className="p-3.5 space-y-3.5 max-w-lg mx-auto">
      {/* 1. Quick Action Header Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenNewSubscriberModal}
          className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#0B1F3B] active:bg-[#142A45] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
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
      <MobileAdSlider className="mt-1" />

      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">حالة تسديد المشتركين</h2>
          <span className="text-[10px] font-bold text-slate-400">إجمالي {formatNumberArabic(totalSubscribers)} مشترك</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => { try { localStorage.setItem('moldatk_mobile_subscribers_filter', 'paid'); } catch (e) {} onNavigateToTab('subscribers'); }}
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
                {formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { try { localStorage.setItem('moldatk_mobile_subscribers_filter', 'unpaid'); } catch (e) {} onNavigateToTab('subscribers'); }}
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
                {formatCurrency(totalUnpaidDebt, generatorSpecs.currency)}
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Ampere discount and previous-month debt controls */}
      <section data-ampere-discount-dashboard-mobile-v1 className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setShowPreviousDebtList(true)} className="min-w-0 rounded-2xl bg-white dark:bg-[#111c38] border border-rose-200 dark:border-rose-900/50 px-2 py-3 text-center shadow-sm active:scale-[0.99] transition-all">
            <span className="block text-[9px] font-black text-slate-500 dark:text-slate-400">ديون الشهر السابق</span>
            <strong className="block mt-1 text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{formatNumberArabic(ampereDiscountSummary.previousDebtSubscribers)}</strong>
            <span className="block mt-1 text-[9px] font-bold text-rose-500 truncate" dir="ltr">{formatCurrency(ampereDiscountSummary.previousDebtAmount, generatorSpecs.currency)}</span>
          </button>
          <div className="min-w-0 rounded-2xl bg-white dark:bg-[#111c38] border border-blue-200 dark:border-blue-900/50 px-2 py-3 text-center shadow-sm">
            <span className="block text-[9px] font-black text-slate-500 dark:text-slate-400">الأمبيرات المحتسبة</span>
            <strong className="block mt-1 text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{formatNumberArabic(ampereDiscountSummary.billedAmperes)}A</strong>
            <span className="block mt-1 text-[9px] font-bold text-slate-400 truncate">خصم {formatNumberArabic(ampereDiscountSummary.discountedAmperes)}A من {formatNumberArabic(ampereDiscountSummary.originalBillableAmperes)}A</span>
          </div>
          <div className="min-w-0 rounded-2xl bg-white dark:bg-[#111c38] border border-amber-200 dark:border-amber-900/50 px-2 py-3 text-center shadow-sm">
            <span className="block text-[9px] font-black text-slate-500 dark:text-slate-400">خصومات الشهر</span>
            <strong className="block mt-1 text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 tabular-nums truncate" dir="ltr">{formatCurrency(ampereDiscountSummary.monthlyDiscountAmount, generatorSpecs.currency)}</strong>
            <span className="block mt-1 text-[9px] font-bold text-slate-400">خصم معتمد من الإدارة</span>
          </div>
        </div>
      </section>

      {showPreviousDebtList && (
        <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" dir="rtl">
          <div className="w-full max-w-lg max-h-[78vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
            <div className="flex items-center justify-between gap-3 sticky top-0 bg-white dark:bg-[#101a33] pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">مدينو الشهر السابق</h3>
                <p className="text-[10px] text-slate-500 mt-1">الشهر {ampereDiscountSummary.previousMonthId} — الإجمالي {formatCurrency(ampereDiscountSummary.previousDebtAmount, generatorSpecs.currency)}</p>
              </div>
              <button type="button" onClick={() => setShowPreviousDebtList(false)} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">إغلاق</button>
            </div>
            {ampereDiscountSummary.previousMonthDebtors.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs font-black text-emerald-700 dark:text-emerald-300">لا توجد ديون متبقية من الشهر السابق.</div>
            ) : (
              <div className="space-y-2">
                {ampereDiscountSummary.previousMonthDebtors.map(row => (
                  <div key={row.subscriber.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="text-xs font-black text-slate-900 dark:text-white truncate">{row.subscriber.fullName}</div><div className="text-[9px] text-slate-400 mt-1">{row.subscriber.code || row.subscriber.subscriberCode}</div></div>
                    <strong className="shrink-0 text-sm font-black text-rose-600 dark:text-rose-400" dir="ltr">{formatCurrency(row.amount, generatorSpecs.currency)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
{/* 3. Cashbox */}
      <button
        type="button"
        onClick={() => onNavigateToTab('wallet')}
        className="w-full overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 border border-emerald-500/40 p-4 text-right text-white shadow-lg active:scale-[0.99] transition-all"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">القاصة</h3>
              <p className="text-[10px] text-emerald-100/90 mt-0.5">إجمالي المبالغ المستحصلة بعد آخر تصفير</p>
            </div>
          </div>

          <div className="text-left shrink-0">
            <span className="block text-lg font-black text-white tabular-nums" dir="ltr">
              {formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-emerald-200">
              فتح القاصة
              <ChevronLeft className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>

      {/* 4. The only new dashboard box requested: current-month tariff total, excluding old debt. */}
      <div className="w-full rounded-3xl bg-gradient-to-l from-[#0B1F3B] via-[#142A45] to-[#0B1F3B] border border-[#F2B544]/35 p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#F2B544]/15 border border-[#F2B544]/30 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-6 h-6 text-[#F2B544]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">المبلغ الكلي لهذا الشهر</h3>
              <p className="text-[10px] text-slate-300/85 mt-0.5">بحسب تسعيرة هذا الشهر فقط — بدون الديون السابقة</p>
            </div>
          </div>
          <strong className="text-xl font-black text-white tabular-nums text-left shrink-0" dir="ltr">
            {formatCurrency(currentMonthTotal, generatorSpecs.currency)}
          </strong>
        </div>
      </div>
    </div>
  );
};

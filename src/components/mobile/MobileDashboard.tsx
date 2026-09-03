import React from 'react';
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
  const totalSubscribers = subscribers.length;

  const currentAccount = (sub: Subscriber) =>
    (sub.invoicesHistory || []).find(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled');

  const paidSubs = subscribers.filter(sub => {
    const invoice = currentAccount(sub);
    if (invoice) return invoice.status !== 'free' && getInvoiceRemaining(invoice) === 0;
    return sub.paymentStatus === 'paid';
  });

  const unpaidSubs = subscribers.filter(sub => {
    const invoice = currentAccount(sub);
    if (invoice) return invoice.status !== 'free' && getInvoiceRemaining(invoice) > 0;
    return sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial';
  });

  const totalCollectedRevenue = subscribers.reduce((acc, sub) => {
    const invoice = currentAccount(sub);
    if (invoice) return acc + Number(invoice.paidAmount || 0);
    return acc + (sub.paymentStatus === 'paid' || sub.paymentStatus === 'partial' ? Number(sub.amountPaid || 0) : 0);
  }, 0);

  const totalUnpaidDebt = subscribers.reduce((acc, sub) => {
    const invoice = currentAccount(sub);
    if (invoice) return acc + getInvoiceRemaining(invoice);
    if (sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial') return acc + Math.max(0, Number(sub.amountDue || 0));
    return acc;
  }, 0);

  // Monthly total is the charge of THIS month only. Old carried debt is deliberately excluded.
  const currentMonthTotal = subscribers.reduce((acc, sub) => {
    const invoice = currentAccount(sub);
    if (invoice) return acc + Number(invoice.totalAmount || 0);
    if (sub.tier === 'free' || sub.isExempted) return acc;
    return acc + calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total;
  }, 0);

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

      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}
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
                {formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}
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
                {formatCurrency(totalUnpaidDebt, generatorSpecs.currency)}
              </span>
            </div>
          </button>
        </div>
      </section>

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
              {formatCurrency(cashboxAmount, generatorSpecs.currency)}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-emerald-200">
              فتح القاصة
              <ChevronLeft className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>

      {/* 4. The only new dashboard box requested: current-month tariff total, excluding old debt. */}
      <div className="w-full rounded-3xl bg-gradient-to-l from-blue-950 via-[#13234a] to-[#111c38] border border-blue-700/60 p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-6 h-6 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">المبلغ الكلي لهذا الشهر</h3>
              <p className="text-[10px] text-blue-200/80 mt-0.5">بحسب تسعيرة هذا الشهر فقط — بدون الديون السابقة</p>
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

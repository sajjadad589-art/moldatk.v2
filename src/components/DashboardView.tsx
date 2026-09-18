import { useCashboxBalance } from '../lib/useCashboxBalance';
import React, { useState } from 'react';
import {
  DollarSign,
  Activity,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ArrowLeft,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, LineDistribution, AuditLogEntry } from '../types';
import { formatCurrency } from '../utils/formatters';
import { getAmpereDiscountDashboardSummary } from '../utils/discountAccounting';
import { reconciledCashbox, summarizeSubscribers } from '../utils/authoritativeAccounting';

interface DashboardViewProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  auditLogs?: AuditLogEntry[];
  walletResetTimestamp?: string;
  activeMonthId?: string;
  onOpenPricingModal: () => void;
  onNavigateToSubscribersTab: (filter?: 'all' | 'paid' | 'unpaid') => void;
  onNavigateToWalletTab: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  subscribers,
  pricingTiers,
  generatorSpecs,
  auditLogs = [],
  walletResetTimestamp,
  activeMonthId,
  onOpenPricingModal,
  onNavigateToSubscribersTab,
  onNavigateToWalletTab,
}) => {
  const [showPreviousDebtList, setShowPreviousDebtList] = useState(false);
  const ampereDiscountSummary = getAmpereDiscountDashboardSummary(subscribers, pricingTiers, activeMonthId);
  // AUTHORITATIVE_FINANCE_V2
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const totalCount = subscribers.length;
  const paidSubscribers = billingCycleActive ? dashboardSummary.paidSubscribers : [];
  const unpaidSubscribers = billingCycleActive ? dashboardSummary.unpaidSubscribers : [];
  const totalUnpaidDebt = billingCycleActive ? dashboardSummary.outstanding : 0;
  const totalCollectedRevenue = useCashboxBalance(billingCycleActive
    ? reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)
    : 0);

  return (
    <div className="space-y-6 font-['Cairo']" dir="rtl">
      {/* 1. TOP 2 MAIN WIDGETS */}
      <section id="main-dashboard-widgets" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#0B1F3B] dark:text-[#F2B544]" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              لوحة قراءات التحصيل والاشتراكات
            </h2>
          </div>
          
          <button
            onClick={() => onNavigateToSubscribersTab('all')}
            className="w-full sm:w-auto justify-center flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-2xl bg-[#0B1F3B] hover:bg-[#142A45] text-white text-xs font-black transition-all duration-200 border border-blue-400/40 shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <span>الانتقال إلى قائمة المشتركين التفصيلية</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* البطاقة اليمنى: تم التسديد */}
          <div className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-wide">تم التسديد</h3>
              <div className="w-5" />
            </div>

            <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="9" fill="transparent" />
                <circle cx="50" cy="50" r="40" className="stroke-emerald-500 transition-all duration-500" strokeWidth="9" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * Math.min(paidSubscribers.length, totalCount)) / (totalCount || 1)} strokeLinecap="round" fill="transparent" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" dir="ltr">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{paidSubscribers.length}</span>
                <span className="text-xs font-bold text-slate-400 mt-1">مشترك</span>
              </div>
            </div>

            <div className="w-full text-center py-2 border-t border-slate-100 dark:border-blue-950/50" dir="ltr">
              <span className="text-lg font-black text-emerald-500 dark:text-emerald-400 tabular-nums">
                {paidSubscribers.reduce((sum, s) => sum + (Number(s.amountPaid) || 0), 0).toLocaleString('en-US')} {generatorSpecs.currency}
              </span>
            </div>
          </div>

          {/* البطاقة اليسرى: مستحق التسديد */}
          <div className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-wide">مستحق التسديد</h3>
              <div className="w-5" />
            </div>

            <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="9" fill="transparent" />
                <circle cx="50" cy="50" r="40" className="stroke-rose-500 transition-all duration-500" strokeWidth="9" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * Math.min(unpaidSubscribers.length, totalCount)) / (totalCount || 1)} strokeLinecap="round" fill="transparent" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" dir="ltr">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{unpaidSubscribers.length}</span>
                <span className="text-xs font-bold text-slate-400 mt-1">مشترك</span>
              </div>
            </div>

            <div className="w-full text-center py-2 border-t border-slate-100 dark:border-blue-950/50" dir="ltr">
              <span className="text-lg font-black text-rose-500 dark:text-rose-400 tabular-nums">
                {totalUnpaidDebt.toLocaleString('en-US')} {generatorSpecs.currency}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section data-ampere-discount-dashboard-desktop-v1 className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={() => setShowPreviousDebtList(true)} className="rounded-3xl bg-white dark:bg-[#131E38] border border-rose-200 dark:border-rose-900/50 p-4 text-right shadow-sm hover:border-rose-400 transition-all">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">ديون الشهر السابق</span>
            <div className="mt-2 flex items-end justify-between gap-2"><strong className="text-3xl font-black text-rose-600 dark:text-rose-400">{ampereDiscountSummary.previousDebtSubscribers}</strong><span className="text-xs font-black text-rose-600" dir="ltr">{formatCurrency(ampereDiscountSummary.previousDebtAmount, generatorSpecs.currency)}</span></div>
          </button>
          <div className="rounded-3xl bg-white dark:bg-[#131E38] border border-blue-200 dark:border-blue-900/50 p-4 shadow-sm">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">الأمبيرات المحتسبة للجباية</span>
            <div className="mt-2"><strong className="text-3xl font-black text-blue-600 dark:text-blue-400">{ampereDiscountSummary.billedAmperes.toLocaleString('en-US')}A</strong><p className="text-[10px] font-bold text-slate-400 mt-1">خصم {ampereDiscountSummary.discountedAmperes.toLocaleString('en-US')}A من {ampereDiscountSummary.originalBillableAmperes.toLocaleString('en-US')}A</p></div>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#131E38] border border-amber-200 dark:border-amber-900/50 p-4 shadow-sm">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">مبالغ الخصومات الشهرية</span>
            <div className="mt-2"><strong className="text-2xl font-black text-amber-600 dark:text-amber-400" dir="ltr">{formatCurrency(ampereDiscountSummary.monthlyDiscountAmount, generatorSpecs.currency)}</strong><p className="text-[10px] font-bold text-slate-400 mt-1">خصومات أمبيرات معتمدة من الإدارة</p></div>
          </div>
        </div>
      </section>

      {showPreviousDebtList && (
        <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h3 className="text-base font-black text-slate-950 dark:text-white">مدينو الشهر السابق</h3><p className="text-xs text-slate-500 mt-1">الشهر {ampereDiscountSummary.previousMonthId} — {formatCurrency(ampereDiscountSummary.previousDebtAmount, generatorSpecs.currency)}</p></div>
              <button type="button" onClick={() => setShowPreviousDebtList(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">إغلاق</button>
            </div>
            {ampereDiscountSummary.previousMonthDebtors.length === 0 ? <div className="py-12 text-center text-sm font-black text-emerald-600">لا توجد ديون متبقية من الشهر السابق.</div> : (
              <div className="space-y-2">{ampereDiscountSummary.previousMonthDebtors.map(row => <div key={row.subscriber.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 flex items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-900 dark:text-white">{row.subscriber.fullName}</div><div className="text-[10px] text-slate-400 mt-1">{row.subscriber.code || row.subscriber.subscriberCode}</div></div><strong className="text-sm font-black text-rose-600" dir="ltr">{formatCurrency(row.amount, generatorSpecs.currency)}</strong></div>)}</div>
            )}
          </div>
        </div>
      )}



      

      

      

      

      

      

      

      

      

      

      

      

      {/* 2. بطاقة القاصة (المحفظة) */}
      <section className="max-w-4xl mx-auto">
        <div 
          onClick={onNavigateToWalletTab}
          className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 dark:from-emerald-950 dark:to-[#131E38] border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:shadow-2xl hover:border-emerald-500 transition-all text-white"
        >
          <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md text-emerald-300 border border-white/20 shadow-inner">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-200 tracking-wider uppercase block">القاصة (المحفظة المالية)</span>
              <span className="text-2xl sm:text-3xl font-black text-white tabular-nums block mt-1 tracking-tight">
                {totalCollectedRevenue.toLocaleString('en-US')} {generatorSpecs.currency}
              </span>
              <span className="text-xs text-emerald-100 font-medium block mt-1 opacity-90">إجمالي المبالغ المستحصلة هذا الشهر</span>
            </div>
          </div>
          
          <div className="w-full sm:w-auto justify-center flex items-center gap-2 text-xs font-black text-white bg-white/15 hover:bg-white/25 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 transition-all shadow-sm">
            <span>فتح القاصة</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* 3. PRICING CONTROL SECTION */}
      <section className="bg-white dark:bg-[#111c38] rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#0B1F3B] dark:text-[#F2B544]">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">التحكم بتسعيرة الأمبير</h3>
              <p className="text-xs text-slate-400 mt-0.5">تعديل أسعار الأمبيرات لكافة الفئات</p>
            </div>
          </div>
          <button
            onClick={onOpenPricingModal}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0B1F3B] hover:bg-[#142A45] text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-900/20"
          >
            <Sliders className="w-4 h-4 text-[#F2B544]" />
            <span>تعديل وضبط التسعيرة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricingTiers.filter(t => t.type !== 'free').map(tier => (
            <div key={tier.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <span className="font-bold text-sm text-slate-900 dark:text-white">{tier.nameAr}</span>
              <div className="text-2xl font-black text-[#1E3A8A] dark:text-[#F2B544] tabular-nums mt-2">
                {formatCurrency(tier.pricePerAmpere)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

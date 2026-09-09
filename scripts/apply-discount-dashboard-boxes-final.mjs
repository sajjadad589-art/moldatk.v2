import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Ampere discount dashboard finalizer: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Reusable dashboard reconciliation helpers.
// -----------------------------------------------------------------------------
write('src/utils/discountAccounting.ts', `import type { Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateMonthlyCharge, getInvoiceRemaining, getMonthId } from './monthlyAccounting';

const n = (v: unknown) => Math.max(0, Number(v) || 0);

function previousMonthId(monthId: string): string {
  const [yearRaw, monthRaw] = String(monthId || getMonthId()).split('-');
  let year = Number(yearRaw) || new Date().getFullYear();
  let month = Number(monthRaw) || 1;
  month -= 1;
  if (month <= 0) { month = 12; year -= 1; }
  return \`${year}-\${String(month).padStart(2, '0')}\`;
}

function newest(list: SubscriberInvoice[]): SubscriberInvoice | undefined {
  return [...list].sort((a, b) => {
    const ad = a.paymentDate || a.issueDate || '';
    const bd = b.paymentDate || b.issueDate || '';
    if (ad !== bd) return bd.localeCompare(ad);
    const ap = n(a.paidAmount), bp = n(b.paidAmount);
    if (ap !== bp) return bp - ap;
    const ar = getInvoiceRemaining(a), br = getInvoiceRemaining(b);
    if (ar !== br) return ar - br;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];
}

function currentInvoice(sub: Subscriber, monthId: string): SubscriberInvoice | undefined {
  return newest((sub.invoicesHistory || []).filter(inv => inv.monthId === monthId && inv.status !== 'cancelled'));
}

function invoiceDiscountSnapshot(sub: Subscriber, inv: SubscriberInvoice | undefined, tiers: SubscriptionTierPricing[]) {
  const isFree = sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free' || inv?.status === 'free';
  if (isFree) return { originalAmperes: 0, discountedAmperes: 0, billedAmperes: 0, discountAmount: 0 };

  if (!inv) {
    const charge = calculateMonthlyCharge(sub, tiers);
    return {
      originalAmperes: charge.originalAmperes,
      discountedAmperes: charge.discountedAmperes,
      billedAmperes: charge.billedAmperes,
      discountAmount: charge.discountAmount,
    };
  }

  const note = String(inv.notes || '');
  if (note.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) {
    return { originalAmperes: 0, discountedAmperes: 0, billedAmperes: 0, discountAmount: 0 };
  }

  const originalAmperes = inv.originalAmperes == null ? n(inv.amperes || sub.amperes) : n(inv.originalAmperes);
  let discountedAmperes = inv.discountedAmperes == null ? 0 : n(inv.discountedAmperes);
  let billedAmperes = inv.billedAmperes == null ? Math.max(0, originalAmperes - discountedAmperes) : n(inv.billedAmperes);
  let discountAmount = inv.discountAmount == null ? 0 : n(inv.discountAmount);

  if (
    inv.discountedAmperes == null &&
    !note.includes('MOLDATK_LUMP_SETTLEMENT') &&
    n(inv.pricePerAmpere) > 0
  ) {
    const gross = n(inv.amperes) * n(inv.pricePerAmpere) + n(inv.fixedFee);
    const inferredMoney = Math.max(0, gross - n(inv.totalAmount));
    discountedAmperes = Math.min(originalAmperes, inferredMoney / n(inv.pricePerAmpere));
    billedAmperes = Math.max(0, originalAmperes - discountedAmperes);
    discountAmount = inferredMoney;
  }

  return { originalAmperes, discountedAmperes, billedAmperes, discountAmount };
}

export function getAmpereDiscountDashboardSummary(
  subscribers: Subscriber[],
  tiers: SubscriptionTierPricing[],
  activeMonthId = getMonthId(),
) {
  const financialRows = subscribers
    .filter(sub => sub.tier !== 'free' && sub.isExempted !== true && sub.paymentStatus !== 'free')
    .map(sub => invoiceDiscountSnapshot(sub, currentInvoice(sub, activeMonthId), tiers));

  const previousId = previousMonthId(activeMonthId);
  const previousMonthDebtors = subscribers.flatMap(sub => {
    if (sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free') return [];
    const inv = currentInvoice(sub, previousId);
    if (!inv || inv.status === 'free') return [];
    const amount = getInvoiceRemaining(inv);
    if (amount <= 0) return [];
    return [{ subscriber: sub, invoice: inv, amount }];
  }).sort((a, b) => b.amount - a.amount);

  return {
    activeMonthId,
    previousMonthId: previousId,
    previousMonthDebtors,
    previousDebtSubscribers: previousMonthDebtors.length,
    previousDebtAmount: previousMonthDebtors.reduce((sum, row) => sum + row.amount, 0),
    originalBillableAmperes: financialRows.reduce((sum, row) => sum + row.originalAmperes, 0),
    discountedAmperes: financialRows.reduce((sum, row) => sum + row.discountedAmperes, 0),
    billedAmperes: financialRows.reduce((sum, row) => sum + row.billedAmperes, 0),
    monthlyDiscountAmount: financialRows.reduce((sum, row) => sum + row.discountAmount, 0),
  };
}
`);

// -----------------------------------------------------------------------------
// 2) Mobile owner dashboard: three requested boxes + previous-month debtor list.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(p);

  if (!s.includes('AMPERE_DISCOUNT_DASHBOARD_MOBILE_V1')) {
    s = s.replace("import React from 'react';", "import React, { useState } from 'react';");
    if (!s.includes("from '../../utils/discountAccounting'")) {
      const importAnchor = "import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';";
      must(s.includes(importAnchor), 'mobile monthly accounting import missing');
      s = s.replace(importAnchor, `${importAnchor}\nimport { getAmpereDiscountDashboardSummary } from '../../utils/discountAccounting';`);
    }

    const summaryAnchor = '  const currentMonthTotal = dashboardSummary.monthTotal;';
    must(s.includes(summaryAnchor), 'mobile authoritative summary anchor missing');
    s = s.replace(
      summaryAnchor,
      `${summaryAnchor}\n  // AMPERE_DISCOUNT_DASHBOARD_MOBILE_V1\n  const ampereDiscountSummary = getAmpereDiscountDashboardSummary(subscribers, pricingTiers, activeMonthId);\n  const [showPreviousDebtList, setShowPreviousDebtList] = useState(false);`
    );

    const cashboxMarker = '      {/* 3. Cashbox */}';
    must(s.includes(cashboxMarker), 'mobile cashbox marker missing');
    const cards = `      {/* Ampere discount and previous-month debt controls */}
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

`;
    s = s.replace(cashboxMarker, cards + cashboxMarker);
  }

  must(s.includes('data-ampere-discount-dashboard-mobile-v1'), 'mobile discount cards missing');
  must(s.includes('showPreviousDebtList'), 'mobile previous debt list missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Desktop owner dashboard: same three boxes and same data source.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/DashboardView.tsx';
  let s = read(p);

  if (!s.includes('AMPERE_DISCOUNT_DASHBOARD_DESKTOP_V1')) {
    s = s.replace("import React from 'react';", "import React, { useState } from 'react';");
    if (!s.includes("from '../utils/discountAccounting'")) {
      const importAnchor = "import { formatCurrency } from '../utils/formatters';";
      must(s.includes(importAnchor), 'desktop format import missing');
      s = s.replace(importAnchor, `${importAnchor}\nimport { getAmpereDiscountDashboardSummary } from '../utils/discountAccounting';`);
    }

    const summaryAnchor = '  const totalCollectedRevenue = reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId);';
    must(s.includes(summaryAnchor), 'desktop authoritative summary anchor missing');
    s = s.replace(
      summaryAnchor,
      `${summaryAnchor}\n  // AMPERE_DISCOUNT_DASHBOARD_DESKTOP_V1\n  const ampereDiscountSummary = getAmpereDiscountDashboardSummary(subscribers, pricingTiers, activeMonthId);\n  const [showPreviousDebtList, setShowPreviousDebtList] = useState(false);`
    );

    const cashboxMarker = '      {/* 2. بطاقة القاصة (المحفظة) */}';
    must(s.includes(cashboxMarker), 'desktop cashbox marker missing');
    const desktopCards = `      <section data-ampere-discount-dashboard-desktop-v1 className="max-w-4xl mx-auto">
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

`;
    s = s.replace(cashboxMarker, desktopCards + cashboxMarker);
  }

  must(s.includes('data-ampere-discount-dashboard-desktop-v1'), 'desktop discount cards missing');
  write(p, s);
}

console.log('Owner dashboards upgraded: previous-month debt list, billed amperes after discount, and monthly discount money all share the invoice ledger.');

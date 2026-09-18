import type { Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateMonthlyCharge, getInvoiceRemaining, getMonthId } from './monthlyAccounting';

const n = (v: unknown) => Math.max(0, Number(v) || 0);

function previousMonthId(monthId: string): string {
  const [yearRaw, monthRaw] = String(monthId || getMonthId()).split('-');
  let year = Number(yearRaw) || new Date().getFullYear();
  let month = Number(monthRaw) || 1;
  month -= 1;
  if (month <= 0) { month = 12; year -= 1; }
  return year + '-' + String(month).padStart(2, '0');
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
  if (!tiers.length) return {
    activeMonthId, previousMonthId: previousMonthId(activeMonthId), previousMonthDebtors: [],
    previousDebtSubscribers: 0, previousDebtAmount: 0, originalBillableAmperes: 0,
    discountedAmperes: 0, billedAmperes: 0, monthlyDiscountAmount: 0,
  };
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

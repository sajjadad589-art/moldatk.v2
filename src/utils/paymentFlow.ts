import type { Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import {
  applyPaymentOldestFirst,
  ensureMonthInvoice,
  getInvoiceRemaining,
  getMonthId,
  getMonthNameAr,
  monthIdToDate,
  calculateMonthlyCharge,
} from './monthlyAccounting';

export const PAYMENT_RECEIPT_PREFIX = 'MOLDATK_PAYMENT_RECEIPT_V1:';

export interface PaymentReceiptMeta {
  previousPaidBefore: number;
  totalOutstandingBefore: number;
  paymentAmount: number;
  totalOutstandingAfter: number;
  carriedDebtBefore: number;
  currentMonthCharge: number;
  currentMonthRemaining: number;
  appliedToPreviousDebt: number;
  appliedToCurrentMonth: number;
  allocations: Array<{ monthId: string; monthNameAr: string; amount: number }>;
}

export interface ApplySubscriberPaymentResult {
  updatedSubscriber: Subscriber;
  receiptInvoice: SubscriberInvoice;
  meta: PaymentReceiptMeta;
}

export function isPaymentReceiptSnapshot(invoice?: SubscriberInvoice | null): boolean {
  return Boolean(invoice?.status === 'cancelled' && String(invoice?.notes || '').startsWith(PAYMENT_RECEIPT_PREFIX));
}

export function parsePaymentReceiptMeta(invoice?: SubscriberInvoice | null): PaymentReceiptMeta | null {
  if (!isPaymentReceiptSnapshot(invoice)) return null;
  try {
    const raw = String(invoice?.notes || '').slice(PAYMENT_RECEIPT_PREFIX.length);
    const parsed = JSON.parse(raw);
    return {
      previousPaidBefore: Math.max(0, Number(parsed.previousPaidBefore || 0)),
      totalOutstandingBefore: Math.max(0, Number(parsed.totalOutstandingBefore || 0)),
      paymentAmount: Math.max(0, Number(parsed.paymentAmount || 0)),
      totalOutstandingAfter: Math.max(0, Number(parsed.totalOutstandingAfter || 0)),
      carriedDebtBefore: Math.max(0, Number(parsed.carriedDebtBefore || 0)),
      currentMonthCharge: Math.max(0, Number(parsed.currentMonthCharge || 0)),
      currentMonthRemaining: Math.max(0, Number(parsed.currentMonthRemaining || 0)),
      appliedToPreviousDebt: Math.max(0, Number(parsed.appliedToPreviousDebt || 0)),
      appliedToCurrentMonth: Math.max(0, Number(parsed.appliedToCurrentMonth || 0)),
      allocations: Array.isArray(parsed.allocations) ? parsed.allocations : [],
    };
  } catch {
    return null;
  }
}

export function getSubscriberOutstanding(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
): number {
  const realInvoices = (subscriber.invoicesHistory || []).filter(inv => inv.status !== 'cancelled');
  if (realInvoices.length) {
    return realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  }

  if (subscriber.paymentStatus === 'paid' || subscriber.paymentStatus === 'free' || subscriber.tier === 'free' || subscriber.isExempted) {
    return 0;
  }

  const due = Math.max(0, Number(subscriber.amountDue || 0));
  if (subscriber.paymentStatus === 'partial') {
    const alreadyPaid = Math.max(0, Number(subscriber.amountPaid || 0));
    if (due > 0 && alreadyPaid > 0) return Math.max(0, due - alreadyPaid);
  }
  if (due > 0) return due;

  return calculateMonthlyCharge(subscriber, pricingTiers).total;
}

export function applySubscriberPayment(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  requestedAmount: number,
  options: {
    activeMonthId?: string;
    activeMonthNameAr?: string;
    collectorName?: string;
    notes?: string;
    now?: Date;
  } = {},
): ApplySubscriberPaymentResult {
  const now = options.now || new Date();
  const activeMonthId = options.activeMonthId || getMonthId(now);
  const activeMonthNameAr = options.activeMonthNameAr || getMonthNameAr(monthIdToDate(activeMonthId));

  const ensured = ensureMonthInvoice(
    subscriber,
    pricingTiers,
    activeMonthId,
    activeMonthNameAr,
    now.toISOString().slice(0, 10),
  );

  const workingSubscriber: Subscriber = {
    ...subscriber,
    invoicesHistory: ensured.invoices,
  };

  const outstandingBefore = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const paymentAmount = Math.min(Math.max(0, Number(requestedAmount || 0)), outstandingBefore);
  if (outstandingBefore <= 0 || paymentAmount <= 0) {
    throw new Error('no_outstanding_debt');
  }

  const previousPaidBefore = ensured.invoices
    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && getInvoiceRemaining(inv) > 0)
    .reduce((sum, inv) => sum + Math.max(0, Number(inv.paidAmount || 0)), 0);

  const paymentResult = applyPaymentOldestFirst(
    workingSubscriber,
    pricingTiers,
    paymentAmount,
    now,
    activeMonthId,
    activeMonthNameAr,
  );

  const appliedAmount = Math.max(0, paymentResult.totalDebtBefore - paymentResult.totalDebtAfter);
  if (appliedAmount <= 0) throw new Error('payment_not_applied');

  const currentInvoice = paymentResult.invoices
    .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')
    .sort((a, b) => String(b.paymentDate || b.issueDate || b.id).localeCompare(String(a.paymentDate || a.issueDate || a.id)))[0];

  const currentPaid = Math.max(0, Number(currentInvoice?.paidAmount || 0));
  const currentRemaining = currentInvoice ? getInvoiceRemaining(currentInvoice) : paymentResult.currentMonthRemaining;
  const currentStatus: Subscriber['paymentStatus'] = currentInvoice?.status === 'free'
    ? 'free'
    : currentRemaining === 0
      ? 'paid'
      : currentPaid > 0
        ? 'partial'
        : 'unpaid';

  const meta: PaymentReceiptMeta = {
    previousPaidBefore,
    totalOutstandingBefore: paymentResult.totalDebtBefore,
    paymentAmount: appliedAmount,
    totalOutstandingAfter: paymentResult.totalDebtAfter,
    carriedDebtBefore: paymentResult.carriedDebtBefore,
    currentMonthCharge: paymentResult.currentMonthCharge,
    currentMonthRemaining: paymentResult.currentMonthRemaining,
    appliedToPreviousDebt: paymentResult.appliedToPreviousDebt,
    appliedToCurrentMonth: paymentResult.appliedToCurrentMonth,
    allocations: paymentResult.allocations,
  };

  const receiptId = `payrec-${now.getTime()}-${subscriber.id}`;
  const receiptInvoice: SubscriberInvoice = {
    id: receiptId,
    subscriberId: subscriber.id,
    receiptNumber: `REC-${subscriber.code || subscriber.subscriberCode || 'MW'}-${now.getTime().toString().slice(-6)}`,
    monthId: activeMonthId,
    monthNameAr: activeMonthNameAr,
    issueDate: now.toISOString().slice(0, 10),
    paymentDate: now.toISOString(),
    amperes: subscriber.amperes,
    tier: subscriber.tier,
    pricePerAmpere: Number(currentInvoice?.pricePerAmpere || 0),
    fixedFee: Number(currentInvoice?.fixedFee || 0),
    totalAmount: paymentResult.totalDebtBefore,
    paidAmount: appliedAmount,
    remainingAmount: paymentResult.totalDebtAfter,
    status: 'cancelled',
    collectorName: options.collectorName || currentInvoice?.collectorName,
    notes: PAYMENT_RECEIPT_PREFIX + JSON.stringify(meta),
    previousDebtBefore: paymentResult.carriedDebtBefore,
    currentCharge: paymentResult.currentMonthCharge,
    totalBeforePayment: paymentResult.totalDebtBefore,
    appliedToPreviousDebt: paymentResult.appliedToPreviousDebt,
    appliedToCurrentMonth: paymentResult.appliedToCurrentMonth,
    totalOutstandingAfter: paymentResult.totalDebtAfter,
    paymentAllocations: paymentResult.allocations,
  };

  const updatedSubscriber: Subscriber = {
    ...subscriber,
    invoicesHistory: [receiptInvoice, ...paymentResult.invoices.filter(inv => inv.id !== receiptInvoice.id)],
    amountDue: paymentResult.totalDebtAfter,
    amountPaid: currentPaid,
    paymentStatus: currentStatus,
    lastPaymentDate: now.toISOString(),
  };

  return { updatedSubscriber, receiptInvoice, meta };
}

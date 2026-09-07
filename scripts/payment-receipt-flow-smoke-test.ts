import assert from 'node:assert/strict';
import type { Subscriber, SubscriptionTierPricing } from '../src/types';
import { getInvoiceRemaining } from '../src/utils/monthlyAccounting';
import {
  applySubscriberPayment,
  getSubscriberOutstanding,
  isPaymentReceiptSnapshot,
  parsePaymentReceiptMeta,
} from '../src/utils/paymentFlow';

const pricing: SubscriptionTierPricing[] = [
  {
    id: 'normal',
    nameAr: 'اعتيادي',
    nameEn: 'Normal',
    type: 'normal',
    pricePerAmpere: 5000,
    fixedFee: 0,
    description: '',
    badgeColor: '',
    is24Hours: false,
    priorityLevel: 1,
  },
];

const makeSubscriber = (): Subscriber => ({
  id: 'sub-payment-regression',
  code: 'MW-TEST-1',
  subscriberCode: 'MW-TEST-1',
  fullName: 'مشترك اختبار',
  phone: '07800000000',
  tier: 'normal',
  amperes: 5,
  lineId: 'line-1',
  lineName: 'كابينة 1',
  paymentStatus: 'unpaid',
  amountDue: 25000,
  amountPaid: 0,
  invoicesHistory: [
    {
      id: 'inv-2026-09-sub-payment-regression',
      subscriberId: 'sub-payment-regression',
      receiptNumber: 'ACC-2026-09-MW-TEST-1',
      monthId: '2026-09',
      monthNameAr: 'شهر 9/2026',
      issueDate: '2026-09-01',
      amperes: 5,
      tier: 'normal',
      pricePerAmpere: 5000,
      fixedFee: 0,
      totalAmount: 25000,
      paidAmount: 0,
      remainingAmount: 25000,
      status: 'unpaid',
    },
  ],
});

// First partial payment: 25,000 total, pay 10,000 => only 15,000 remains.
const first = applySubscriberPayment(makeSubscriber(), pricing, 10000, {
  activeMonthId: '2026-09',
  activeMonthNameAr: 'شهر 9/2026',
  collectorName: 'اختبار',
  now: new Date('2026-09-07T07:00:00.000Z'),
});

assert.equal(first.meta.totalOutstandingBefore, 25000);
assert.equal(first.meta.previousPaidBefore, 0);
assert.equal(first.meta.paymentAmount, 10000);
assert.equal(first.meta.totalOutstandingAfter, 15000);
assert.equal(first.updatedSubscriber.amountDue, 15000);
assert.equal(first.updatedSubscriber.paymentStatus, 'partial');
assert.equal(getSubscriberOutstanding(first.updatedSubscriber, pricing), 15000);
assert.ok(isPaymentReceiptSnapshot(first.receiptInvoice));
assert.equal(getInvoiceRemaining(first.receiptInvoice), 0, 'Receipt snapshots must never become accounting debt');
assert.equal(first.receiptInvoice.paymentDate, '2026-09-07T07:00:00.000Z');

const firstRealInvoice = (first.updatedSubscriber.invoicesHistory || []).find(inv => inv.id === 'inv-2026-09-sub-payment-regression');
assert.ok(firstRealInvoice);
assert.equal(firstRealInvoice?.paidAmount, 10000);
assert.equal(firstRealInvoice?.remainingAmount, 15000);
assert.equal(firstRealInvoice?.status, 'partial');

// Complete the same partial invoice later. The old 10,000 must be retained and the
// payment screen should expose only the remaining 15,000.
const secondNow = new Date('2026-09-07T08:30:00.000Z');
assert.equal(getSubscriberOutstanding(first.updatedSubscriber, pricing), 15000);
const second = applySubscriberPayment(first.updatedSubscriber, pricing, 15000, {
  activeMonthId: '2026-09',
  activeMonthNameAr: 'شهر 9/2026',
  collectorName: 'اختبار',
  now: secondNow,
});

assert.equal(second.meta.totalOutstandingBefore, 15000);
assert.equal(second.meta.previousPaidBefore, 10000);
assert.equal(second.meta.paymentAmount, 15000);
assert.equal(second.meta.totalOutstandingAfter, 0);
assert.equal(second.updatedSubscriber.amountDue, 0);
assert.equal(second.updatedSubscriber.paymentStatus, 'paid');
assert.equal(getSubscriberOutstanding(second.updatedSubscriber, pricing), 0);
assert.equal(second.receiptInvoice.paymentDate, secondNow.toISOString(), 'Reprints must retain the original payment timestamp');

const secondMeta = parsePaymentReceiptMeta(second.receiptInvoice);
assert.ok(secondMeta);
assert.equal(secondMeta?.previousPaidBefore, 10000);
assert.equal(secondMeta?.totalOutstandingBefore, 15000);
assert.equal(secondMeta?.paymentAmount, 15000);
assert.equal(secondMeta?.totalOutstandingAfter, 0);

const secondRealInvoice = (second.updatedSubscriber.invoicesHistory || []).find(inv => inv.id === 'inv-2026-09-sub-payment-regression');
assert.ok(secondRealInvoice);
assert.equal(secondRealInvoice?.paidAmount, 25000);
assert.equal(secondRealInvoice?.remainingAmount, 0);
assert.equal(secondRealInvoice?.status, 'paid');

const accountingDebt = (second.updatedSubscriber.invoicesHistory || [])
  .filter(inv => inv.status !== 'cancelled')
  .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
assert.equal(accountingDebt, 0, 'Historical payment receipts must not duplicate debt');

const receiptSnapshots = (second.updatedSubscriber.invoicesHistory || []).filter(isPaymentReceiptSnapshot);
assert.equal(receiptSnapshots.length, 2, 'Both payment receipts must remain available for reprint');
assert.equal(receiptSnapshots[0].paymentDate, '2026-09-07T08:30:00.000Z');
assert.equal(receiptSnapshots[1].paymentDate, '2026-09-07T07:00:00.000Z');

console.log('Payment receipt regression passed: partial 10k/25k leaves 15k, final payment completes debt, cumulative paid reaches 25k, and both original-dated receipts remain reprintable.');

import assert from 'node:assert/strict';
import type { Subscriber, SubscriptionTierPricing } from '../src/types';
import { applyPaymentOldestFirst, buildMonthlyReports, getInvoiceRemaining } from '../src/utils/monthlyAccounting';

const tiers: SubscriptionTierPricing[] = [
  {
    id: 'normal',
    nameAr: 'عادي',
    nameEn: 'Normal',
    type: 'normal',
    pricePerAmpere: 4000,
    fixedFee: 0,
    description: '',
    badgeColor: 'blue',
    is24Hours: false,
    priorityLevel: 1,
  },
];

const subscriber: Subscriber = {
  id: 'sub-smoke-1',
  code: 'MW-TEST',
  fullName: 'اختبار الديون الشهرية',
  phone: '07700000000',
  tier: 'normal',
  amperes: 5,
  paymentStatus: 'unpaid',
  amountDue: 30000,
  amountPaid: 0,
  invoicesHistory: [
    {
      id: 'inv-2026-08-sub-smoke-1',
      subscriberId: 'sub-smoke-1',
      monthId: '2026-08',
      monthNameAr: 'شهر 8 (آب 2026)',
      issueDate: '2026-08-01',
      amperes: 5,
      tier: 'normal',
      pricePerAmpere: 2000,
      fixedFee: 0,
      totalAmount: 10000,
      paidAmount: 0,
      remainingAmount: 10000,
      status: 'unpaid',
    },
    {
      id: 'inv-2026-09-sub-smoke-1',
      subscriberId: 'sub-smoke-1',
      monthId: '2026-09',
      monthNameAr: 'شهر 9 (أيلول 2026)',
      issueDate: '2026-09-01',
      amperes: 5,
      tier: 'normal',
      pricePerAmpere: 4000,
      fixedFee: 0,
      totalAmount: 20000,
      paidAmount: 0,
      remainingAmount: 20000,
      status: 'unpaid',
    },
  ],
};

const paid = applyPaymentOldestFirst(
  subscriber,
  tiers,
  15000,
  new Date('2026-09-03T10:00:00Z'),
  '2026-09',
  'شهر 9 (أيلول 2026)',
);

const august = paid.invoices.find(inv => inv.monthId === '2026-08');
const september = paid.invoices.find(inv => inv.monthId === '2026-09');
assert(august && september, 'Both monthly invoices must remain present');
assert.equal(getInvoiceRemaining(august), 0, 'Old August debt must be paid first');
assert.equal(Number(august.paidAmount || 0), 10000, 'August must receive first 10,000');
assert.equal(Number(september.paidAmount || 0), 5000, 'Only remaining 5,000 goes to September');
assert.equal(getInvoiceRemaining(september), 15000, 'September balance must remain 15,000');
assert.equal(paid.appliedToPreviousDebt, 10000, 'Receipt split must show 10,000 to previous debt');
assert.equal(paid.appliedToCurrentMonth, 5000, 'Receipt split must show 5,000 to current month');
assert.equal(paid.totalDebtAfter, 15000, 'Total debt after payment must remain 15,000');

const updatedSubscriber: Subscriber = {
  ...subscriber,
  invoicesHistory: paid.invoices,
  amountDue: paid.totalDebtAfter,
  amountPaid: Number(september.paidAmount || 0),
  paymentStatus: 'partial',
};
const reports = buildMonthlyReports([updatedSubscriber]);
const augustReport = reports.find(report => report.monthId === '2026-08');
const septemberReport = reports.find(report => report.monthId === '2026-09');
assert(augustReport && septemberReport, 'Historical reports must expose both August and September');
assert.equal(augustReport.totalAmount, 10000, 'August historical charge must not be changed by September tariff');
assert.equal(augustReport.paidAmount, 10000, 'August historical collection must remain paid');
assert.equal(augustReport.debtAmount, 0, 'August debt must be cleared after allocation');
assert.equal(septemberReport.totalAmount, 20000, 'September must preserve its own tariff-derived charge');
assert.equal(septemberReport.paidAmount, 5000, 'September report must show only its allocated payment');
assert.equal(septemberReport.debtAmount, 15000, 'September report must show its remaining balance');
assert.equal(septemberReport.partialCount, 1, 'September subscriber must be partial');

console.log('Monthly ledger smoke tests passed: independent months, oldest-first debt allocation, and historical reports.');

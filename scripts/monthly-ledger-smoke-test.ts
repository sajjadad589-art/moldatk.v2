import assert from 'node:assert/strict';
import type { MonthlyTariffRecord, Subscriber, SubscriptionTierPricing } from '../src/types';
import {
  activateMonthlyTariffForSubscribers,
  applyPaymentOldestFirst,
  buildMonthlyReports,
  getInvoiceRemaining,
  getMonthNameAr,
} from '../src/utils/monthlyAccounting';

const tiersAugust: SubscriptionTierPricing[] = [
  {
    id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal', pricePerAmpere: 2000,
    fixedFee: 0, description: '', badgeColor: 'blue', is24Hours: false, priorityLevel: 1,
  },
  {
    id: 'commercial', nameAr: 'محلات', nameEn: 'Commercial', type: 'commercial', pricePerAmpere: 3000,
    fixedFee: 0, description: '', badgeColor: 'amber', is24Hours: false, priorityLevel: 2,
  },
  {
    id: 'golden', nameAr: 'ذهبي', nameEn: 'Golden', type: 'golden', pricePerAmpere: 5000,
    fixedFee: 0, description: '', badgeColor: 'emerald', is24Hours: true, priorityLevel: 3,
  },
  {
    id: 'free', nameAr: 'مجاني', nameEn: 'Free', type: 'free', pricePerAmpere: 0,
    fixedFee: 0, description: '', badgeColor: 'purple', is24Hours: false, priorityLevel: 0,
  },
];

const tiersSeptember: SubscriptionTierPricing[] = tiersAugust.map(t => ({
  ...t,
  pricePerAmpere: t.type === 'normal' ? 4000 : t.type === 'commercial' ? 4500 : t.type === 'golden' ? 6500 : 0,
}));

const augustTariff: MonthlyTariffRecord = {
  id: '2026-08', month: 8, year: 2026, monthNameAr: '8-2026', tiers: tiersAugust,
  createdAt: '2026-08-01', isCurrentActive: true,
};
const septemberTariff: MonthlyTariffRecord = {
  id: '2026-09', month: 9, year: 2026, monthNameAr: '9-2026', tiers: tiersSeptember,
  createdAt: '2026-09-01', isCurrentActive: true,
};

const makeSubscriber = (overrides: Partial<Subscriber>): Subscriber => ({
  id: 'sub-default',
  code: 'MW-TEST',
  fullName: 'اختبار محاسب',
  phone: '07700000000',
  tier: 'normal',
  amperes: 5,
  paymentStatus: 'unpaid',
  amountDue: 0,
  amountPaid: 0,
  invoicesHistory: [],
  ...overrides,
});

const augustInvoice = (
  subscriberId: string,
  paidAmount: number,
  status: 'paid' | 'partial' | 'unpaid' = paidAmount >= 10000 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
) => ({
  id: `inv-2026-08-${subscriberId}`,
  subscriberId,
  monthId: '2026-08',
  monthNameAr: '8-2026',
  issueDate: '2026-08-01',
  amperes: 5,
  tier: 'normal' as const,
  pricePerAmpere: 2000,
  fixedFee: 0,
  totalAmount: 10000,
  paidAmount,
  remainingAmount: Math.max(0, 10000 - paidAmount),
  status,
});

// ---------------------------------------------------------------------------
// 1) New month must reset current-month paid counters and create a fresh bill.
// ---------------------------------------------------------------------------
const previouslyPaid = makeSubscriber({
  id: 'sub-paid-aug',
  paymentStatus: 'paid',
  amountDue: 0,
  amountPaid: 10000,
  lastPaymentDate: '2026-08-15T10:00:00Z',
  invoicesHistory: [augustInvoice('sub-paid-aug', 10000, 'paid')],
});

const previouslyUnpaid = makeSubscriber({
  id: 'sub-unpaid-aug',
  paymentStatus: 'unpaid',
  amountDue: 10000,
  invoicesHistory: [augustInvoice('sub-unpaid-aug', 0, 'unpaid')],
});

const previouslyPartial = makeSubscriber({
  id: 'sub-partial-aug',
  paymentStatus: 'partial',
  amountDue: 5000,
  amountPaid: 5000,
  invoicesHistory: [augustInvoice('sub-partial-aug', 5000, 'partial')],
});

const freeSubscriber = makeSubscriber({
  id: 'sub-free',
  tier: 'free',
  paymentStatus: 'free',
  amountDue: 0,
  amountPaid: 0,
  invoicesHistory: [],
});

const rolled = activateMonthlyTariffForSubscribers(
  [previouslyPaid, previouslyUnpaid, previouslyPartial, freeSubscriber],
  augustTariff,
  septemberTariff,
  new Date('2026-09-01T08:00:00Z'),
);

const rolledPaid = rolled.find(s => s.id === 'sub-paid-aug')!;
const rolledUnpaid = rolled.find(s => s.id === 'sub-unpaid-aug')!;
const rolledPartial = rolled.find(s => s.id === 'sub-partial-aug')!;
const rolledFree = rolled.find(s => s.id === 'sub-free')!;

for (const sub of [rolledPaid, rolledUnpaid, rolledPartial]) {
  const sep = sub.invoicesHistory!.find(inv => inv.monthId === '2026-09' && inv.status !== 'cancelled');
  assert(sep, `${sub.id}: September invoice must be created`);
  assert.equal(sep.totalAmount, 20000, `${sub.id}: September tariff must charge 5A x 4,000`);
  assert.equal(sep.paidAmount, 0, `${sub.id}: new month must start with zero paid amount`);
  assert.equal(sep.remainingAmount, 20000, `${sub.id}: new month must start fully outstanding`);
  assert.equal(sep.status, 'unpaid', `${sub.id}: new month must start unpaid`);
  assert.equal(sub.paymentStatus, 'unpaid', `${sub.id}: dashboard/card current status must reset to unpaid`);
  assert.equal(sub.amountPaid, 0, `${sub.id}: active-month paid summary must reset to zero`);
}

assert.equal(rolledPaid.amountDue, 20000, 'Previously paid subscriber owes only the new September charge');
assert.equal(rolledUnpaid.amountDue, 30000, 'Old 10,000 debt + new 20,000 charge must both remain due');
assert.equal(rolledPartial.amountDue, 25000, 'Old 5,000 debt + new 20,000 charge must both remain due');
assert.equal(rolledUnpaid.invoicesHistory!.find(i => i.monthId === '2026-08')!.totalAmount, 10000, 'August frozen charge must not change');
assert.equal(rolledFree.invoicesHistory!.find(i => i.monthId === '2026-09')!.status, 'free', 'Free account remains free in the new month');
assert.equal(rolledFree.amountDue, 0, 'Free current account must not receive a monthly charge');

const septemberResetReport = buildMonthlyReports(rolled).find(r => r.monthId === '2026-09')!;
assert.equal(septemberResetReport.paidCount, 0, 'Paid counter must reset to zero on a brand-new month');
assert.equal(septemberResetReport.partialCount, 0, 'Partial counter must reset to zero on a brand-new month');
assert.equal(septemberResetReport.unpaidCount, 3, 'Every non-free subscriber must start as unpaid');
assert.equal(septemberResetReport.freeCount, 1, 'Free subscriber is counted separately');
assert.equal(septemberResetReport.paidAmount, 0, 'Collected amount for a new month must start at zero');
assert.equal(septemberResetReport.totalAmount, 60000, 'New month total must use only the new tariff for non-free subscribers');
assert.equal(septemberResetReport.debtAmount, 60000, 'Current-month outstanding report must initially equal current-month charges');

// ---------------------------------------------------------------------------
// 2) Oldest-first debt allocation: old debt closes before current month.
// ---------------------------------------------------------------------------
const debtSubscriber = rolledUnpaid;
const payment = applyPaymentOldestFirst(
  debtSubscriber,
  tiersSeptember,
  15000,
  new Date('2026-09-03T10:00:00Z'),
  '2026-09',
  '9-2026',
);
const augustAfter = payment.invoices.find(inv => inv.monthId === '2026-08')!;
const septemberAfter = payment.invoices.find(inv => inv.monthId === '2026-09')!;
assert.equal(getInvoiceRemaining(augustAfter), 0, 'Old August debt must be paid first');
assert.equal(Number(augustAfter.paidAmount || 0), 10000, 'August must receive first 10,000');
assert.equal(Number(septemberAfter.paidAmount || 0), 5000, 'Only the remaining 5,000 goes to September');
assert.equal(getInvoiceRemaining(septemberAfter), 15000, 'September balance remains 15,000');
assert.equal(payment.appliedToPreviousDebt, 10000, 'Receipt split shows 10,000 toward previous debt');
assert.equal(payment.appliedToCurrentMonth, 5000, 'Receipt split shows 5,000 toward current month');
assert.equal(payment.totalDebtAfter, 15000, 'Total remaining debt is correct');

// ---------------------------------------------------------------------------
// 3) Reports must preserve each month independently after allocations.
// ---------------------------------------------------------------------------
const afterPaymentSubscriber: Subscriber = {
  ...debtSubscriber,
  invoicesHistory: payment.invoices,
  amountDue: payment.totalDebtAfter,
  amountPaid: Number(septemberAfter.paidAmount || 0),
  paymentStatus: 'partial',
};
const reports = buildMonthlyReports([afterPaymentSubscriber]);
const augustReport = reports.find(report => report.monthId === '2026-08')!;
const septemberReport = reports.find(report => report.monthId === '2026-09')!;
assert.equal(augustReport.totalAmount, 10000, 'August historical charge remains frozen');
assert.equal(augustReport.paidAmount, 10000, 'August historical payment reflects debt allocation');
assert.equal(augustReport.debtAmount, 0, 'August debt closes after allocation');
assert.equal(septemberReport.totalAmount, 20000, 'September keeps its own tariff-derived charge');
assert.equal(septemberReport.paidAmount, 5000, 'September shows only its allocated payment');
assert.equal(septemberReport.debtAmount, 15000, 'September shows its remaining current-month balance');
assert.equal(septemberReport.partialCount, 1, 'September subscriber is partial after a partial allocation');

// ---------------------------------------------------------------------------
// 4) Editing the active tariff recalculates unpaid/partial accounts but freezes paid ones.
// ---------------------------------------------------------------------------
const moreExpensiveSeptember: MonthlyTariffRecord = {
  ...septemberTariff,
  tiers: tiersSeptember.map(t => t.type === 'normal' ? { ...t, pricePerAmpere: 5000 } : t),
};
const partialCurrent = makeSubscriber({
  id: 'partial-current',
  paymentStatus: 'partial',
  amountDue: 15000,
  amountPaid: 5000,
  invoicesHistory: [{
    id: 'inv-2026-09-partial-current', subscriberId: 'partial-current', monthId: '2026-09', monthNameAr: '9-2026',
    issueDate: '2026-09-01', amperes: 5, tier: 'normal', pricePerAmpere: 4000, fixedFee: 0,
    totalAmount: 20000, paidAmount: 5000, remainingAmount: 15000, status: 'partial',
  }],
});
const paidCurrent = makeSubscriber({
  id: 'paid-current',
  paymentStatus: 'paid',
  amountDue: 0,
  amountPaid: 20000,
  invoicesHistory: [{
    id: 'inv-2026-09-paid-current', subscriberId: 'paid-current', monthId: '2026-09', monthNameAr: '9-2026',
    issueDate: '2026-09-01', paymentDate: '2026-09-02T12:00:00Z', amperes: 5, tier: 'normal', pricePerAmpere: 4000,
    fixedFee: 0, totalAmount: 20000, paidAmount: 20000, remainingAmount: 0, status: 'paid',
  }],
});
const repriced = activateMonthlyTariffForSubscribers(
  [partialCurrent, paidCurrent],
  septemberTariff,
  moreExpensiveSeptember,
  new Date('2026-09-04T08:00:00Z'),
);
const repricedPartial = repriced.find(s => s.id === 'partial-current')!;
const repricedPaid = repriced.find(s => s.id === 'paid-current')!;
assert.equal(repricedPartial.invoicesHistory![0].totalAmount, 25000, 'Partial current account adopts changed tariff');
assert.equal(repricedPartial.invoicesHistory![0].paidAmount, 5000, 'Existing partial payment is preserved');
assert.equal(repricedPartial.invoicesHistory![0].remainingAmount, 20000, 'Partial remaining amount is recalculated correctly');
assert.equal(repricedPaid.invoicesHistory![0].totalAmount, 20000, 'Fully paid monthly invoice is frozen against later tariff edits');
assert.equal(repricedPaid.paymentStatus, 'paid', 'Paid current-month status stays paid');

// ---------------------------------------------------------------------------
// 5) Duplicate snapshots: monthly reports must select the newest/canonical state.
// ---------------------------------------------------------------------------
const duplicateSnapshotSubscriber = makeSubscriber({
  id: 'duplicate-snapshot',
  invoicesHistory: [
    {
      id: 'old-snapshot', subscriberId: 'duplicate-snapshot', monthId: '2026-09', monthNameAr: '9-2026', issueDate: '2026-09-01',
      amperes: 5, tier: 'normal', pricePerAmpere: 4000, fixedFee: 0, totalAmount: 20000, paidAmount: 0,
      remainingAmount: 20000, status: 'unpaid',
    },
    {
      id: 'new-snapshot', subscriberId: 'duplicate-snapshot', monthId: '2026-09', monthNameAr: '9-2026', issueDate: '2026-09-01',
      paymentDate: '2026-09-03T12:00:00Z', amperes: 5, tier: 'normal', pricePerAmpere: 4000, fixedFee: 0,
      totalAmount: 20000, paidAmount: 20000, remainingAmount: 0, status: 'paid',
    },
  ],
});
const duplicateReport = buildMonthlyReports([duplicateSnapshotSubscriber]).find(r => r.monthId === '2026-09')!;
assert.equal(duplicateReport.paidCount, 1, 'Latest paid snapshot wins over stale duplicate unpaid snapshot');
assert.equal(duplicateReport.unpaidCount, 0, 'Stale duplicate must not inflate unpaid count');

assert.equal(getMonthNameAr(new Date(2026, 8, 1)), '9-2026', 'Month labels must be numeric: 9-2026');

console.log('Accountant monthly regression suite passed: rollover reset, carried debt, oldest-first payments, repricing protection, reports, duplicates, free accounts, and numeric month labels.');

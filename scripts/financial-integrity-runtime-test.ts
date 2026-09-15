import assert from 'node:assert/strict';
import {
  activateMonthlyTariffForSubscribers,
  applyPaymentOldestFirst,
  calculateMonthlyCharge,
  getInvoiceRemaining,
} from '../src/utils/monthlyAccounting.ts';
import { removeUnpaidMonthLedger } from '../src/utils/monthlyTariffDeletion.ts';

const tier = (price: number) => ({
  id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal', pricePerAmpere: price,
  fixedFee: 0, description: '', badgeColor: 'blue', is24Hours: false, priorityLevel: 1,
}) as any;
const month = (id: string, price: number, active = false) => ({
  id, month: Number(id.slice(5, 7)), year: Number(id.slice(0, 4)), monthNameAr: id,
  tiers: [tier(price)], createdAt: `${id}-01T00:00:00.000Z`, isCurrentActive: active,
}) as any;
const baseSubscriber = () => ({
  id: 's1', code: 'S1', fullName: 'Test', phone: '07800000000', amperes: 5,
  tier: 'normal', lineName: 'L1', line: 'L1', paymentStatus: 'unpaid', amountDue: 0,
  amountPaid: 0, invoicesHistory: [],
}) as any;

// 1) Month charge + ampere discount are deterministic.
{
  const s = { ...baseSubscriber(), ampereDiscount: 2 };
  const c = calculateMonthlyCharge(s, [tier(10_000)]);
  assert.equal(c.originalAmperes, 5);
  assert.equal(c.discountedAmperes, 2);
  assert.equal(c.billedAmperes, 3);
  assert.equal(c.grossTotal, 50_000);
  assert.equal(c.discountAmount, 20_000);
  assert.equal(c.total, 30_000);
}

// 2) Carry-forward is represented by OLD invoices only. New invoice balance never contains old debt.
let s = baseSubscriber();
s = activateMonthlyTariffForSubscribers([s], undefined, month('2026-08', 10_000, true), new Date('2026-08-01T00:00:00Z'))[0];
assert.equal(s.amountDue, 50_000);
assert.equal(getInvoiceRemaining(s.invoicesHistory.find((i: any) => i.monthId === '2026-08')!), 50_000);

s = activateMonthlyTariffForSubscribers([s], month('2026-08', 10_000), month('2026-09', 8_000, true), new Date('2026-09-01T00:00:00Z'))[0];
const aug = s.invoicesHistory.find((i: any) => i.monthId === '2026-08')!;
const sep = s.invoicesHistory.find((i: any) => i.monthId === '2026-09')!;
assert.equal(getInvoiceRemaining(aug), 50_000);
assert.equal(getInvoiceRemaining(sep), 40_000, 'new month invoice must contain current charge only');
assert.equal(s.amountDue, 90_000, 'subscriber debt is sum of monthly balances exactly once');

// 3) Partial payment allocates oldest-first and never over-applies.
{
  const r = applyPaymentOldestFirst(s, [tier(8_000)], 60_000, new Date('2026-09-10T12:00:00Z'), '2026-09', '9-2026');
  const a = r.invoices.find(i => i.monthId === '2026-08')!;
  const b = r.invoices.find(i => i.monthId === '2026-09')!;
  assert.equal(getInvoiceRemaining(a), 0);
  assert.equal(getInvoiceRemaining(b), 30_000);
  assert.equal(r.appliedToPreviousDebt, 50_000);
  assert.equal(r.appliedToCurrentMonth, 10_000);
  assert.equal(r.totalDebtAfter, 30_000);
}

// 4) Deleting an UNPAID tariff removes that month's liability instead of hiding/carrying it.
{
  const cleaned = removeUnpaidMonthLedger([s], '2026-08', '2026-09')[0];
  assert.equal(cleaned.invoicesHistory.some((i: any) => i.monthId === '2026-08' && i.status !== 'cancelled'), false);
  assert.equal(cleaned.amountDue, 40_000);
}

// 5) A paid/partial month cannot be silently erased by the local destructive helper.
{
  const paid = applyPaymentOldestFirst(s, [tier(8_000)], 1_000, new Date('2026-09-10T12:00:00Z'), '2026-09', '9-2026');
  const paidSub = { ...s, invoicesHistory: paid.invoices } as any;
  assert.throws(() => removeUnpaidMonthLedger([paidSub], '2026-08', '2026-09'), /MONTH_HAS_PAYMENTS/);
}

// 6) Free/exempt subscribers never accumulate a monthly liability.
{
  const free = { ...baseSubscriber(), tier: 'free', paymentStatus: 'free' } as any;
  const result = activateMonthlyTariffForSubscribers([free], undefined, {
    ...month('2026-09', 8_000, true), tiers: [{ ...tier(8_000), id: 'free', type: 'free', nameAr: 'مجاني' }],
  } as any, new Date('2026-09-01T00:00:00Z'))[0];
  assert.equal(result.amountDue, 0);
  assert.equal(result.invoicesHistory[0].remainingAmount, 0);
  assert.equal(result.invoicesHistory[0].status, 'free');
}

console.log('Financial integrity runtime regression passed: pricing, discounts, carry, partial payment, deletion, and free-account invariants.');

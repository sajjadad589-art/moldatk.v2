import assert from 'node:assert/strict';
import {
  activateMonthlyTariffForSubscribers,
  applyLumpSettlementAllDebt,
  applyPaymentOldestFirst,
  calculateMonthlyCharge,
  getInvoiceRemaining,
} from '../src/utils/monthlyAccounting.ts';
import { extinguishDeletedTariffLiabilities, removeUnpaidMonthLedger } from '../src/utils/monthlyTariffDeletion.ts';

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

// 3) Standard partial payment remains oldest-first and DOES leave the unpaid balance.
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

// 4) LUMP payment is intentionally different: ANY valid agreed amount closes ALL debts.
{
  const r = applyLumpSettlementAllDebt(s, [tier(8_000)], 25_000, new Date('2026-09-11T12:00:00Z'), '2026-09', '9-2026');
  assert.equal(r.totalDebtBefore, 90_000);
  assert.equal(r.receivedAmount, 25_000);
  assert.equal(r.waivedAmount, 65_000);
  assert.equal(r.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0), 0);
  assert.equal(r.invoices.filter(inv => inv.status !== 'cancelled' && inv.status !== 'free').every(inv => inv.status === 'paid'), true);
  assert.equal(r.invoices.some(inv => String(inv.notes || '').includes('MOLDATK_LUMP_SETTLEMENT_ALL_DEBT')), true);
}

// 5) Deleting an unpaid tariff removes that month's liability immediately.
{
  const cleaned = removeUnpaidMonthLedger([s], '2026-08', '2026-09')[0];
  assert.equal(cleaned.invoicesHistory.some((i: any) => i.monthId === '2026-08' && i.status !== 'cancelled'), false);
  assert.equal(cleaned.amountDue, 40_000);
}

// 6) Production tariff deletion can also remove a PARTIAL month: actual cash history survives,
//    but that deleted month's remaining debt becomes exactly zero.
{
  const partial = applyPaymentOldestFirst(s, [tier(8_000)], 10_000, new Date('2026-09-10T12:00:00Z'), '2026-09', '9-2026');
  const partialSub = { ...s, invoicesHistory: partial.invoices, amountDue: partial.totalDebtAfter } as any;
  const cleaned = extinguishDeletedTariffLiabilities([partialSub], ['2026-08'], '2026-09')[0];
  const old = cleaned.invoicesHistory.find((i: any) => i.monthId === '2026-08');
  assert.ok(old, 'paid history for deleted tariff must remain auditable');
  assert.equal(old!.paidAmount, 10_000);
  assert.equal(old!.totalAmount, 10_000);
  assert.equal(getInvoiceRemaining(old!), 0);
  assert.equal(String(old!.notes || '').includes('MOLDATK_TARIFF_DELETED_SETTLED_HISTORY'), true);
  assert.equal(cleaned.amountDue, 40_000, 'only surviving month debt remains');
}

// 7) Free/exempt subscribers never accumulate a monthly liability.
{
  const free = { ...baseSubscriber(), tier: 'free', paymentStatus: 'free' } as any;
  const result = activateMonthlyTariffForSubscribers([free], undefined, {
    ...month('2026-09', 8_000, true), tiers: [{ ...tier(8_000), id: 'free', type: 'free', nameAr: 'مجاني' }],
  } as any, new Date('2026-09-01T00:00:00Z'))[0];
  assert.equal(result.amountDue, 0);
  assert.equal(result.invoicesHistory[0].remainingAmount, 0);
  assert.equal(result.invoicesHistory[0].status, 'free');
}

console.log('Financial integrity runtime regression passed: pricing, carry, standard partial payment, all-debt lump settlement, tariff deletion, and free-account invariants.');

import assert from 'node:assert/strict';
import type { Subscriber } from '../src/types';
import { hasPaymentsInMonth, removeUnpaidMonthLedger } from '../src/utils/monthlyTariffDeletion';

const base: Subscriber = {
  id: 'delete-test',
  code: 'MW-DEL',
  fullName: 'اختبار مسح التسعيرة',
  phone: '07700000000',
  tier: 'normal',
  amperes: 5,
  paymentStatus: 'unpaid',
  amountDue: 30000,
  amountPaid: 0,
  invoicesHistory: [
    {
      id: 'aug', subscriberId: 'delete-test', monthId: '2026-08', monthNameAr: '8-2026', issueDate: '2026-08-01',
      amperes: 5, tier: 'normal', pricePerAmpere: 2000, fixedFee: 0, totalAmount: 10000,
      paidAmount: 0, remainingAmount: 10000, status: 'unpaid',
    },
    {
      id: 'sep', subscriberId: 'delete-test', monthId: '2026-09', monthNameAr: '9-2026', issueDate: '2026-09-01',
      amperes: 5, tier: 'normal', pricePerAmpere: 4000, fixedFee: 0, totalAmount: 20000,
      paidAmount: 0, remainingAmount: 20000, status: 'unpaid',
    },
  ],
};

assert.equal(hasPaymentsInMonth([base], '2026-09'), false, 'Unpaid active month is safe to delete');
const reverted = removeUnpaidMonthLedger([base], '2026-09', '2026-08')[0];
assert.equal(reverted.invoicesHistory?.some(i => i.monthId === '2026-09'), false, 'Deleted month invoice must be removed');
assert.equal(reverted.amountDue, 10000, 'Deleting an unpaid accidental month must remove only that month charge');
assert.equal(reverted.paymentStatus, 'unpaid', 'Previous active month status must be restored');

const withPayment: Subscriber = {
  ...base,
  invoicesHistory: base.invoicesHistory!.map(i => i.monthId === '2026-09'
    ? { ...i, paidAmount: 5000, remainingAmount: 15000, status: 'partial' as const }
    : i),
};
assert.equal(hasPaymentsInMonth([withPayment], '2026-09'), true, 'Any payment must protect the month from deletion');
assert.throws(
  () => removeUnpaidMonthLedger([withPayment], '2026-09', '2026-08'),
  /MONTH_HAS_PAYMENTS/,
  'A month with payments must never be deleted',
);

console.log('Tariff deletion regression suite passed: unpaid accidental month can be reverted, paid month is protected.');

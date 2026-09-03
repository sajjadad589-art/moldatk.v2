import assert from 'node:assert/strict';
import type { MonthlyTariffRecord, Subscriber, SubscriptionTierPricing } from '../src/types';
import { startFreshMonthlyCycle, repriceActiveMonthlyCycle, zeroLiveMonthlyCycle } from '../src/utils/monthlyCycleEngine';

const tiers = (price: number): SubscriptionTierPricing[] => [{ id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal', pricePerAmpere: price, fixedFee: 0, description: '', badgeColor: 'blue', is24Hours: false, priorityLevel: 1 }];
const aug: MonthlyTariffRecord = { id: '2026-08', month: 8, year: 2026, monthNameAr: '8-2026', tiers: tiers(6000), createdAt: '2026-08-01', isCurrentActive: true };
const sep: MonthlyTariffRecord = { id: '2026-09', month: 9, year: 2026, monthNameAr: '9-2026', tiers: tiers(12000), createdAt: '2026-09-01', isCurrentActive: true };
const oct: MonthlyTariffRecord = { id: '2026-10', month: 10, year: 2026, monthNameAr: '10-2026', tiers: tiers(14000), createdAt: '2026-10-01', isCurrentActive: true };

const paid: Subscriber = { id: 'p', code: 'P', fullName: 'P', phone: '', tier: 'normal', amperes: 5, paymentStatus: 'paid', amountDue: 0, amountPaid: 30000, invoicesHistory: [{ id: 'aug-p', subscriberId: 'p', monthId: '2026-08', monthNameAr: '8-2026', issueDate: '2026-08-01', amperes: 5, tier: 'normal', pricePerAmpere: 6000, fixedFee: 0, totalAmount: 30000, paidAmount: 30000, remainingAmount: 0, status: 'paid' }] };
const debt: Subscriber = { id: 'd', code: 'D', fullName: 'D', phone: '', tier: 'normal', amperes: 5, paymentStatus: 'unpaid', amountDue: 30000, amountPaid: 0, invoicesHistory: [{ id: 'aug-d', subscriberId: 'd', monthId: '2026-08', monthNameAr: '8-2026', issueDate: '2026-08-01', amperes: 5, tier: 'normal', pricePerAmpere: 6000, fixedFee: 0, totalAmount: 30000, paidAmount: 0, remainingAmount: 30000, status: 'unpaid' }] };

const rolled = startFreshMonthlyCycle([paid, debt], aug, sep, new Date('2026-09-01T08:00:00Z'));
assert.equal(rolled[0].paymentStatus, 'unpaid');
assert.equal(rolled[0].amountPaid, 0);
assert.equal(rolled[0].amountDue, 60000);
assert.equal(rolled[1].amountDue, 90000);
assert.equal(rolled[1].invoicesHistory?.find(i => i.monthId === '2026-08')?.remainingAmount, 30000);

const partial: Subscriber = { ...rolled[0], paymentStatus: 'partial', amountPaid: 20000, amountDue: 40000, invoicesHistory: rolled[0].invoicesHistory!.map(i => i.monthId === '2026-09' ? { ...i, paidAmount: 20000, remainingAmount: 40000, status: 'partial' as const } : i) };
const repriced = repriceActiveMonthlyCycle([partial], { ...sep, tiers: tiers(14000) })[0];
assert.equal(repriced.amountPaid, 20000);
assert.equal(repriced.paymentStatus, 'partial');
assert.equal(repriced.invoicesHistory?.find(i => i.monthId === '2026-09')?.remainingAmount, 50000);

const orphan: Subscriber = { ...repriced, invoicesHistory: [...(repriced.invoicesHistory || []), { id: 'orphan', subscriberId: 'p', monthId: '2026-10', monthNameAr: '10-2026', issueDate: '2026-09-03', amperes: 5, tier: 'normal', pricePerAmpere: 14000, fixedFee: 0, totalAmount: 70000, paidAmount: 70000, remainingAmount: 0, status: 'paid' }] };
const freshOct = startFreshMonthlyCycle([orphan], sep, oct)[0];
const octInvoices = freshOct.invoicesHistory!.filter(i => i.monthId === '2026-10' && i.status !== 'cancelled');
assert.equal(octInvoices.length, 1);
assert.equal(octInvoices[0].paidAmount, 0);
assert.equal(freshOct.paymentStatus, 'unpaid');

const zeroed = zeroLiveMonthlyCycle([freshOct])[0];
assert.equal(zeroed.amountDue, 0);
assert.equal(zeroed.amountPaid, 0);
assert.equal(zeroed.invoicesHistory?.length, freshOct.invoicesHistory?.length);
console.log('Authoritative monthly pricing regression passed.');

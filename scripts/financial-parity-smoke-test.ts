import assert from 'node:assert/strict';
import type { Subscriber, SubscriptionTierPricing } from '../src/types';
import { summarizeSubscribers } from '../src/utils/authoritativeAccounting';

const activeMonthId = '2026-09';
const tiers: SubscriptionTierPricing[] = [{
  id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal',
  pricePerAmpere: 10000, fixedFee: 0, description: '', badgeColor: '',
  is24Hours: false, priorityLevel: 1,
}];

const makeSub = (index: number, status: 'paid' | 'unpaid'): Subscriber => ({
  id: `sub-${index}`,
  code: `MW-${index}`,
  fullName: `Subscriber ${index}`,
  phone: '',
  tier: 'normal',
  amperes: 1,
  lineId: 'line-1',
  lineName: 'Cabinet 1',
  paymentStatus: status,
  amountDue: status === 'paid' ? 0 : 10000,
  amountPaid: status === 'paid' ? 10000 : 0,
  invoicesHistory: [{
    id: `inv-${activeMonthId}-${index}`,
    subscriberId: `sub-${index}`,
    monthId: activeMonthId,
    monthNameAr: 'شهر 9',
    issueDate: '2026-09-01',
    paymentDate: status === 'paid' ? '2026-09-09T08:00:00.000Z' : undefined,
    amperes: 1,
    tier: 'normal',
    pricePerAmpere: 10000,
    fixedFee: 0,
    totalAmount: 10000,
    paidAmount: status === 'paid' ? 10000 : 0,
    remainingAmount: status === 'paid' ? 0 : 10000,
    status,
  }],
});

const subscribers: Subscriber[] = [
  makeSub(1, 'paid'), makeSub(2, 'paid'), makeSub(3, 'paid'), makeSub(4, 'paid'), makeSub(5, 'unpaid'),
];

const summary = summarizeSubscribers(subscribers, tiers, activeMonthId);
assert.equal(summary.paidSubscribers.length, 4, 'Owner authoritative dashboard must report exactly 4 paid subscribers');
assert.equal(summary.unpaidSubscribers.length, 1, 'Owner authoritative dashboard must report exactly 1 debtor');
assert.equal(summary.collected, 40000, 'Collected amount must equal four fully paid subscriptions');
assert.equal(summary.outstanding, 10000, 'Outstanding amount must equal the one real debt');
assert.equal(summary.monthTotal, 50000, 'Monthly effective total must equal collected + outstanding');
assert.equal(summary.collected + summary.outstanding, summary.monthTotal, 'Dashboard accounting identity must balance');

// Collector dashboard calls getSubscriberFinancialRow for the same population and applies
// these exact predicates; keep a source-level assertion so collector cannot silently drift.
const fs = await import('node:fs');
const pos = fs.readFileSync('src/components/POSQuickView.tsx', 'utf8');
assert(pos.includes('getSubscriberFinancialRow(sub, pricingTiers, activeMonthId)'), 'Collector must use the owner financial classifier');
assert(pos.includes("row.status === 'paid' && row.outstanding === 0 && row.billed > 0"), 'Collector paid predicate drifted from owner');
assert(pos.includes("row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'"), 'Collector debtor predicate drifted from owner');

console.log('Financial parity regression passed: 5 subscribers => owner/collector semantics are 4 paid + 1 debtor; totals balance 40,000 + 10,000 = 50,000.');

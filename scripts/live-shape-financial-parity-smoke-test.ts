import assert from 'node:assert/strict';
import type { Subscriber, SubscriptionTierPricing } from '../src/types';
import { summarizeSubscribers } from '../src/utils/authoritativeAccounting';

const tiers: SubscriptionTierPricing[] = [
  { id: 'normal', type: 'normal', name: 'اعتيادي', pricePerAmpere: 12000, fixedFee: 0 },
  { id: 'commercial', type: 'commercial', name: 'تجاري', pricePerAmpere: 18000, fixedFee: 0 },
  { id: 'golden', type: 'golden', name: 'ذهبي', pricePerAmpere: 25000, fixedFee: 0 },
  { id: 'free', type: 'free', name: 'مجاني', pricePerAmpere: 0, fixedFee: 0 },
];

const paid = (id: string, tier: Subscriber['tier'], amperes: number, total: number): Subscriber => ({
  id, code: id, fullName: id, phone: '', tier, amperes,
  paymentStatus: 'paid', amountDue: 0, amountPaid: total,
  invoicesHistory: [{
    id: `inv-2026-09-${id}`, subscriberId: id, monthId: '2026-09', monthNameAr: '9-2026',
    issueDate: '2026-09-01', amperes, tier, pricePerAmpere: total / amperes, fixedFee: 0,
    totalAmount: total, paidAmount: total, remainingAmount: 0, status: 'paid',
  }],
});

const subscribers: Subscriber[] = [
  paid('22', 'normal', 5, 60000),
  paid('33', 'commercial', 5, 90000),
  // Deliberately malformed historical cloud invoice for a permanently free subscriber.
  // This must never become a debtor or a paid collector row.
  {
    id: '44', code: '44', fullName: '44', phone: '', tier: 'free', amperes: 5,
    paymentStatus: 'free', amountDue: 0, amountPaid: 0,
    invoicesHistory: [{
      id: 'inv-2026-09-44', subscriberId: '44', monthId: '2026-09', monthNameAr: '9-2026',
      issueDate: '2026-09-01', amperes: 5, tier: 'free', pricePerAmpere: 15000, fixedFee: 0,
      totalAmount: 75000, paidAmount: 0, remainingAmount: 75000, status: 'unpaid',
    }],
  },
  {
    id: '567890', code: '567890', fullName: '567890', phone: '', tier: 'normal', amperes: 5,
    paymentStatus: 'unpaid', amountDue: 60000, amountPaid: 0, invoicesHistory: [],
  },
  paid('sajad', 'golden', 3, 75000),
  paid('zaman', 'golden', 2, 50000),
];

const owner = summarizeSubscribers(subscribers, tiers, '2026-09');
const collectorRows = owner.rows.filter(r => !r.isFree);
const collectorPaid = collectorRows.filter(r => r.status === 'paid' && r.outstanding === 0 && r.bill > 0);
const collectorUnpaid = collectorRows.filter(r => r.outstanding > 0 || r.status === 'unpaid' || r.status === 'partial');

assert.equal(owner.paidSubscribers.length, 4, 'owner must show exactly four paid subscribers');
assert.equal(owner.unpaidSubscribers.length, 1, 'owner must show exactly one debtor');
assert.equal(collectorPaid.length, 4, 'collector must show exactly four paid subscribers');
assert.equal(collectorUnpaid.length, 1, 'collector must show exactly one debtor');
assert.equal(owner.rows.find(r => r.sub.id === '44')?.isFree, true, 'free subscriber must remain excluded even with malformed invoice');
assert.equal(owner.rows.find(r => r.sub.id === '567890')?.status, 'unpaid', '60k server debtor must remain unpaid');
assert.equal(owner.rows.find(r => r.sub.id === '567890')?.outstanding, 60000, 'debtor balance must stay 60k');
assert.equal(owner.paidSubscribers.map(s => s.id).sort().join(','), collectorPaid.map(r => r.sub.id).sort().join(','), 'owner and collector paid identities must match');

console.log('Live-shape finance parity passed: 6 cloud rows => 4 paid + 1 debtor + 1 free; malformed free invoice is excluded and owner/collector paid identities match.');

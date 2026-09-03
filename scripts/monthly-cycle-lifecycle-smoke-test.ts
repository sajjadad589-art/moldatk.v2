import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { MonthlyTariffRecord, Subscriber } from '../src/types';
import { activateMonthlyTariffForSubscribers } from '../src/utils/monthlyAccounting';
import { zeroLiveMonthlyCycle } from '../src/utils/monthlyCycleEngine';

const aug: MonthlyTariffRecord = {
  id: '2026-08', month: 8, year: 2026, monthNameAr: '8-2026', createdAt: '2026-08-01', isCurrentActive: false,
  tiers: [
    { id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal', pricePerAmpere: 2000, fixedFee: 0, description: '', badgeColor: 'blue', is24Hours: false, priorityLevel: 1 },
  ],
};
const sep: MonthlyTariffRecord = {
  id: '2026-09', month: 9, year: 2026, monthNameAr: '9-2026', createdAt: '2026-09-01', isCurrentActive: true,
  tiers: [
    { id: 'normal', nameAr: 'نهاري', nameEn: 'Normal', type: 'normal', pricePerAmpere: 3000, fixedFee: 0, description: '', badgeColor: 'blue', is24Hours: false, priorityLevel: 1 },
  ],
};

const makeSub = (id: string, status: Subscriber['paymentStatus'], paid: number, remaining: number): Subscriber => ({
  id,
  code: 'MW-' + id,
  fullName: 'اختبار ' + id,
  phone: '07700000000',
  tier: 'normal',
  amperes: 5,
  paymentStatus: status,
  amountPaid: paid,
  amountDue: remaining,
  invoicesHistory: [{
    id: 'inv-2026-08-' + id,
    subscriberId: id,
    monthId: '2026-08',
    monthNameAr: '8-2026',
    issueDate: '2026-08-01',
    amperes: 5,
    tier: 'normal',
    pricePerAmpere: 2000,
    fixedFee: 0,
    totalAmount: 10000,
    paidAmount: paid,
    remainingAmount: remaining,
    status,
  }],
});

const paidPrevious = makeSub('paid', 'paid', 10000, 0);
const unpaidPrevious = makeSub('unpaid', 'unpaid', 0, 10000);
const partialPrevious = makeSub('partial', 'partial', 5000, 5000);
const rolled = activateMonthlyTariffForSubscribers([paidPrevious, unpaidPrevious, partialPrevious], aug, sep, new Date('2026-09-01T08:00:00Z'));

for (const sub of rolled) {
  const current = sub.invoicesHistory?.find(inv => inv.monthId === '2026-09');
  assert(current, 'Every subscriber must get a September invoice');
  assert.equal(current?.paidAmount, 0, 'New month paid counter must start at zero');
  assert.equal(current?.status, 'unpaid', 'New month must start unpaid for billable subscribers');
  assert.equal(sub.amountPaid, 0, 'Live paid amount must reset to zero for the new month');
  assert.equal(sub.paymentStatus, 'unpaid', 'Live card/filter status must reset to unpaid');
}

assert.equal(rolled.find(s => s.id === 'paid')?.amountDue, 15000, 'Paid previous month should owe only the new month');
assert.equal(rolled.find(s => s.id === 'unpaid')?.amountDue, 25000, 'Unpaid previous month debt must carry into the new month');
assert.equal(rolled.find(s => s.id === 'partial')?.amountDue, 20000, 'Partial previous month remainder must carry as old debt');
assert.equal(rolled.find(s => s.id === 'partial')?.invoicesHistory?.find(i => i.monthId === '2026-08')?.remainingAmount, 5000, 'Historical partial debt must stay frozen');

const zeroed = zeroLiveMonthlyCycle(rolled);
for (const sub of zeroed) {
  assert.equal(sub.amountDue, 0, 'Empty tariff list must zero the live due amount');
  assert.equal(sub.amountPaid, 0, 'Empty tariff list must zero the live paid counter');
  assert.equal(sub.paymentStatus, 'unpaid', 'Empty tariff list must reset billable subscribers to unpaid');
  assert((sub.invoicesHistory || []).length > 0, 'Empty tariff list must preserve historical invoices');
}

// Static integration invariants after the final build-time patch has run.
const pricing = fs.readFileSync('src/components/PricingModal.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const engine = fs.readFileSync('src/utils/monthlyCycleEngine.ts', 'utf8');
const sync = fs.readFileSync('src/lib/useGeneratorCloudSync.ts', 'utf8');
const mobileDashboard = fs.readFileSync('src/components/mobile/MobileDashboard.tsx', 'utf8');
const desktopDashboard = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

assert(pricing.includes("onSaveMonthlyTariffs(updatedTariffs, monthId, true);"), 'Creating a tariff must activate the monthly cycle immediately');
assert(pricing.includes("onSaveMonthlyTariffs([], '', false);"), 'The final remaining tariff must be deletable');
assert(pricing.includes('لا توجد تسعيرة معتمدة حالياً'), 'Pricing editor must support a genuinely empty tariff list');
assert(!pricing.includes('لا يمكن حذف آخر تسعيرة موجودة'), 'The last tariff must not be protected from deletion');

assert(app.includes("getStorageKey('moldatk_deleted_tariffs')"), 'Tariff deletions need sync tombstones');
assert(app.includes('zeroLiveMonthlyCycle(subscribers)'), 'App must explicitly zero the live state when tariff list is empty');
assert(app.includes('startFreshMonthlyCycle('), 'App must use a dedicated fresh-month rollover engine');
assert(app.includes('repriceActiveMonthlyCycle('), 'Editing the active month must preserve recorded payments');
assert(app.includes("getStorageKey('moldatk_active_monthly_cycle')"), 'Monthly activation must be idempotent');
assert(engine.includes('amountDue: 0'), 'Monthly engine must zero live due when there is no active tariff');
assert(engine.includes('amountPaid: 0'), 'Monthly engine must zero live paid counter when there is no active tariff');
assert(engine.includes("? 'free' : 'unpaid'"), 'Monthly engine must reset billable live status safely');

assert(mobileDashboard.includes('const billingCycleActive = pricingTiers.some'), 'Mobile dashboard must detect whether a live tariff exists');
assert(mobileDashboard.includes('const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];'), 'Mobile paid counter must be zero with no tariff');
assert(mobileDashboard.includes("const unpaidSubs = billingCycleActive"), 'Mobile unpaid counter must be gated by the active tariff');
assert(mobileDashboard.includes('const currentMonthTotal = billingCycleActive'), 'Mobile monthly total must be zero with no tariff');
assert(desktopDashboard.includes('const billingCycleActive = pricingTiers.some'), 'Desktop dashboard must detect whether a live tariff exists');
assert(desktopDashboard.includes('const paidSubscribers = billingCycleActive'), 'Desktop paid counter must be zero with no tariff');
assert(desktopDashboard.includes('const totalUnpaidDebt = billingCycleActive'), 'Desktop unpaid amount must be zero with no tariff');

assert(sync.includes("deletedTariffs: key('moldatk_deleted_tariffs', generatorId)"), 'Cloud sync must persist tariff deletion tombstones');
assert(sync.includes(".delete().eq('generator_id', generatorId).in('id', deletedTariffIds)"), 'Cloud sync must delete tombstoned tariffs remotely');
assert(sync.includes('.filter(t => !deletedTariffSet.has(t.id))'), 'Cloud pull must never resurrect a deleted tariff');

console.log('Monthly cycle lifecycle suite passed: monthly reset, carried debt, delete-all tariffs, zero live state, zero dashboard billing readings, idempotent activation, and sync-safe deletion.');

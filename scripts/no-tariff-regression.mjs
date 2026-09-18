import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

fs.mkdirSync('.test-output', { recursive: true });
const source = fs.readFileSync('src/utils/pricingAvailability.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
fs.writeFileSync('.test-output/pricingAvailability.mjs', compiled);
const { hasMonthlyPricing, suspendSubscriberBilling, NO_TARIFF_LABEL } = await import('../.test-output/pricingAvailability.mjs');

const historical = {
  id: 'sub-regression', code: 'R1', fullName: 'اختبار', tier: 'normal', amperes: 5,
  paymentStatus: 'paid', amountDue: 120000, amountPaid: 120000,
  invoicesHistory: [{ id: 'old-invoice', monthId: '2026-08', totalAmount: 120000, paidAmount: 120000, remainingAmount: 0, status: 'paid' }],
};

assert.equal(hasMonthlyPricing([]), false, 'empty tariff list must disable billing');
assert.equal(hasMonthlyPricing([{ id: 'tier-normal', type: 'normal', nameAr: 'اعتيادي', pricePerAmpere: 0, fixedFee: 0 }]), true, 'saved tariff remains a tariff even at zero price');
const suspended = suspendSubscriberBilling(historical);
assert.equal(suspended.amountDue, 0);
assert.equal(suspended.amountPaid, 0);
assert.equal(suspended.invoicesHistory.length, 1, 'history must remain intact');
assert.equal(NO_TARIFF_LABEL, 'لا توجد تسعيرة');

for (const [path, markers] of Object.entries({
  'src/App.tsx': ['zeroLiveMonthlyCycle', 'moldatk_deleted_tariffs'],
  'src/utils/authoritativeAccounting.ts': ["status: 'no_tariff'"],
  'src/components/SubscriberModal.tsx': ['hasPricing', 'if (!hasMonthlyPricing(pricingTiers)) return;'],
  'src/components/PaymentMethodModal.tsx': ['!subscriber || !hasMonthlyPricing(pricingTiers)'],
  'src/components/POSQuickView.tsx': ['!hasMonthlyPricing(pricingTiers)'],
  'src/components/SubscribersView.tsx': ['NO_TARIFF_LABEL', 'bg-white text-slate-900'],
  'src/components/mobile/MobileSubscribers.tsx': ['no_tariff', 'NO_TARIFF_LABEL'],
})) {
  const text = fs.readFileSync(path, 'utf8');
  for (const marker of markers) assert.ok(text.includes(marker), `${path} missing ${marker}`);
  if (path === 'src/utils/authoritativeAccounting.ts') assert.ok(text.includes('hasMonthlyPricing(tiers)') || text.includes('hasMonthlyPricing(pricingTiers)'), `${path} missing monthly-pricing availability guard`);
}
// Exercise the actual generated components and accounting code, not only markers.
await build({ stdin: { contents: `
export { MobileSubscribers } from './src/components/mobile/MobileSubscribers';
export { SubscribersView } from './src/components/SubscribersView';
export { SubscriberModal } from './src/components/SubscriberModal';
export { PaymentMethodModal } from './src/components/PaymentMethodModal';
export { POSQuickView } from './src/components/POSQuickView';
export { getSubscriberFinancialRow } from './src/utils/authoritativeAccounting';
export { applyPaymentOldestFirst } from './src/utils/monthlyAccounting';
export { zeroLiveMonthlyCycle } from './src/utils/monthlyCycleEngine';
export { getAmpereDiscountDashboardSummary } from './src/utils/discountAccounting';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm',
  packages: 'external', outfile: '.test-output/no-tariff-components.mjs', logLevel: 'silent' });
const actual = await import('../.test-output/no-tariff-components.mjs');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const tariffs = [{ id: 'normal', type: 'normal', nameAr: 'اعتيادي', pricePerAmpere: 23000, fixedFee: 0 }];
const noop = () => {};
const common = { lines: [], collectors: [], pricingTiers: [], onClose: noop, onSaveSubscriber: noop,
  onOpenSubscriberModal: noop, onOpenReceiptModal: noop, onTogglePaymentStatus: noop,
  onDeleteSubscriber: noop, onConfirmPayment: noop, onAddAuditLog: noop, onLogout: noop };
const render = (component, props) => renderToStaticMarkup(React.createElement(component, { ...common, ...props }));
let rendered = 0;
for (const status of ['unpaid', 'partial', 'paid', 'free']) {
  const subscriber = { ...historical, paymentStatus: status, amountDue: 196000, amountPaid: 92000 };
  const before = structuredClone(subscriber);
  const row = actual.getSubscriberFinancialRow(subscriber, [], '2026-09');
  assert.equal(row.status, 'no_tariff');
  assert.deepEqual([row.bill, row.paid, row.outstanding], [0, 0, 0]);
  const mobile = render(actual.MobileSubscribers, { subscribers: [subscriber] });
  assert.match(mobile, /data-billing-state="no_tariff"/);
  assert.match(mobile, /bg-white dark:bg-white/);
  assert.match(mobile, /لا توجد تسعيرة/);
  assert.doesNotMatch(mobile, /196,000|92,000|bg-\[#8A2F3E\]/);
  const desktop = render(actual.SubscribersView, { subscribers: [subscriber] });
  assert.match(desktop, /لا توجد تسعيرة/);
  assert.doesNotMatch(desktop, /196,000|92,000/);
  const detail = render(actual.SubscriberModal, { isOpen: true, subscriberToEdit: subscriber });
  assert.match(detail, /لا يوجد مبلغ مطلوب/);
  assert.doesNotMatch(detail, /تسديد المشترك|تسديد مخصص|إلغاء التسديد|196,000|92,000/);
  assert.equal(render(actual.PaymentMethodModal, { isOpen: true, subscriber }), '', 'already-open payment form disappears after deletion');
  const pos = render(actual.POSQuickView, { subscribers: [subscriber], assignedAllLines: true,
    collectorName: 'Test', generatorSpecs: {} });
  assert.match(pos, /التسديد متوقف/);
  assert.doesNotMatch(pos, /196,000|92,000/);
  const cleared = actual.zeroLiveMonthlyCycle([subscriber])[0];
  assert.deepEqual([cleared.amountDue, cleared.amountPaid], [0, 0]);
  assert.deepEqual(cleared.invoicesHistory, before.invoicesHistory);
  assert.deepEqual(subscriber, before, 'rendering and clearing must not mutate original history');
  rendered += 5;
}
const unpaid = { ...historical, paymentStatus: 'unpaid', amountDue: 196000, amountPaid: 0 };
const dashboard = actual.getAmpereDiscountDashboardSummary([{ ...unpaid, invoicesHistory: [
  { ...historical.invoicesHistory[0], paidAmount: 0, remainingAmount: 120000, status: 'unpaid' }
]}], [], '2026-09');
assert.equal(dashboard.previousDebtAmount, 0);
assert.equal(dashboard.monthlyDiscountAmount, 0);
for (const file of ['src/components/DashboardView.tsx','src/components/mobile/MobileDashboard.tsx']) {
  assert.equal((fs.readFileSync(file,'utf8').match(/<section data-ampere-discount-dashboard/g) || []).length, 1, 'build must not duplicate dashboard sections');
}
assert.match(render(actual.MobileSubscribers, { subscribers: [unpaid], pricingTiers: tariffs }), /bg-\[#8A2F3E\]/);
assert.match(render(actual.SubscriberModal, { isOpen: true, subscriberToEdit: unpaid, pricingTiers: tariffs }), /تسديد المشترك/);
assert.match(render(actual.PaymentMethodModal, { isOpen: true, subscriber: unpaid, pricingTiers: tariffs }), /<form/);
assert.throws(() => actual.applyPaymentOldestFirst(unpaid, [], 1000), /NO_MONTHLY_TARIFF/);
console.log(`No-tariff regression: PASS (${rendered} actual UI renders, active tariff controls, payment engine blocked, history preserved).`);

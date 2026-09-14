import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

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
  'src/utils/authoritativeAccounting.ts': ['hasMonthlyPricing(tiers)', "status: 'no_tariff'"],
  'src/components/SubscriberModal.tsx': ['hasPricing', 'if (!hasMonthlyPricing(pricingTiers)) return;'],
  'src/components/PaymentMethodModal.tsx': ['!subscriber || !hasMonthlyPricing(pricingTiers)'],
  'src/components/POSQuickView.tsx': ['!hasMonthlyPricing(pricingTiers)'],
  'src/components/SubscribersView.tsx': ['NO_TARIFF_LABEL', 'bg-white text-slate-900'],
  'src/components/mobile/MobileSubscribers.tsx': ['no_tariff', 'NO_TARIFF_LABEL'],
})) {
  const text = fs.readFileSync(path, 'utf8');
  for (const marker of markers) assert.ok(text.includes(marker), `${path} missing ${marker}`);
}
console.log('No-tariff regression: PASS (zero payable, payment blocked, white cards, history preserved).');

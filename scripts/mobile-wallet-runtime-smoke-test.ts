import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(`Mobile wallet runtime regression: ${message}`);
};

const layout = read('src/components/mobile/MobileLayout.tsx');
const app = read('src/App.tsx');
const wallet = read('src/components/WalletView.tsx');
const accounting = read('src/utils/authoritativeAccounting.ts');
const dashboard = read('src/components/mobile/MobileDashboard.tsx');

const walletTab = layout.indexOf("activeTab === 'wallet'");
const walletStart = layout.indexOf('<WalletView', walletTab);
const walletEnd = layout.indexOf('/>', walletStart);
assert(walletTab >= 0 && walletStart >= 0 && walletEnd > walletStart, 'wallet route/call missing');
const walletBlock = layout.slice(walletStart, walletEnd + 2);
assert(walletBlock.includes('subscribers={subscribers}'), 'subscriber ledger not passed to wallet');
assert(walletBlock.includes('pricingTiers={pricingTiers}'), 'pricing tiers not passed to wallet');
assert(walletBlock.includes('activeMonthId={activeMonthId}'), 'active month not passed to wallet');
assert(walletBlock.includes('auditLogs={auditLogs}'), 'audit logs not passed to wallet');
assert(walletBlock.includes('walletResetTimestamp={walletResetTimestamp}'), 'cashbox reset timestamp not passed');

const dashboardStart = layout.indexOf('<MobileDashboard');
const dashboardEnd = layout.indexOf('/>', dashboardStart);
assert(dashboardStart >= 0 && dashboardEnd > dashboardStart, 'MobileDashboard call missing');
const dashboardBlock = layout.slice(dashboardStart, dashboardEnd + 2);
assert(dashboardBlock.includes('activeMonthId={activeMonthId}'), 'active month not passed to dashboard');
assert(dashboardBlock.includes('cashboxAmount={mobileCashboxAmount}'), 'reconciled cashbox not passed to dashboard');

const mobileStart = app.indexOf('<MobileLayout');
const mobileEnd = app.indexOf('/>', mobileStart);
assert(mobileStart >= 0 && mobileEnd > mobileStart, 'App MobileLayout call missing');
const mobileBlock = app.slice(mobileStart, mobileEnd + 2);
assert(mobileBlock.includes('pricingTiers={pricingTiers}'), 'App pricing tiers not passed to MobileLayout');
assert(mobileBlock.includes('activeMonthId={activeMonthRecord?.id}'), 'App active tariff month not passed to MobileLayout');

assert(layout.includes('MOBILE_CASHBOX_SINGLE_SOURCE_V3'), 'single-source cashbox calculation missing');
assert(
  layout.includes('reconciledCashbox(\n    mobileCashboxSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,'),
  'dashboard cashbox does not use the same reconciliation inputs as WalletView'
);
assert(wallet.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)'), 'authoritative wallet accounting missing');
assert(
  wallet.includes('reconciledCashbox(walletSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)'),
  'WalletView reconciled cashbox calculation missing'
);
assert(accounting.includes('tiers: SubscriptionTierPricing[] = []'), 'defensive authoritative pricing fallback missing');
assert(dashboard.includes("onNavigateToTab('wallet')"), 'cashbox dashboard button no longer routes to wallet');

const cashboxStart = dashboard.indexOf('      {/* 3. Cashbox */}');
const cashboxEnd = dashboard.indexOf('      {/* 4.', cashboxStart);
assert(cashboxStart >= 0 && cashboxEnd > cashboxStart, 'dashboard cashbox section missing');
const cashboxSection = dashboard.slice(cashboxStart, cashboxEnd);
assert(
  cashboxSection.includes('{formatCurrency(cashboxAmount, generatorSpecs.currency)}'),
  'dashboard cashbox is not bound to the reconciled cashbox prop'
);
assert(
  !cashboxSection.includes('{formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}'),
  'dashboard cashbox incorrectly uses unreconciled monthly collected total'
);

console.log('Mobile cashbox runtime + amount parity regression: OK');

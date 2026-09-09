import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(`Mobile wallet runtime regression: ${message}`);
};

const layout = read('src/components/mobile/MobileLayout.tsx');
const app = read('src/App.tsx');
const wallet = read('src/components/WalletView.tsx');
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

const mobileStart = app.indexOf('<MobileLayout');
const mobileEnd = app.indexOf('/>', mobileStart);
assert(mobileStart >= 0 && mobileEnd > mobileStart, 'App MobileLayout call missing');
const mobileBlock = app.slice(mobileStart, mobileEnd + 2);
assert(mobileBlock.includes('pricingTiers={pricingTiers}'), 'App pricing tiers not passed to MobileLayout');
assert(mobileBlock.includes('activeMonthId={activeMonthRecord?.id}'), 'App active tariff month not passed to MobileLayout');

assert(wallet.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)'), 'authoritative wallet accounting missing');
assert(/pricingTiers\s*=\s*\[\],/.test(wallet), 'defensive wallet pricing fallback missing');
assert(dashboard.includes("onNavigateToTab('wallet')"), 'cashbox dashboard button no longer routes to wallet');

console.log('Mobile cashbox runtime wiring regression: OK');

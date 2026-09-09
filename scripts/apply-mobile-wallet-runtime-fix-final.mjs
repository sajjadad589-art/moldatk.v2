import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (value, message) => {
  if (!value) throw new Error(`Mobile wallet runtime finalizer: ${message}`);
};

const getComponentBlock = (source, startToken) => {
  const start = source.indexOf(startToken);
  const end = source.indexOf('/>', start);
  must(start >= 0 && end > start, `${startToken} block missing`);
  return { start, end: end + 2, block: source.slice(start, end + 2) };
};

// The mobile wallet is injected by an older compatibility patch. The authoritative
// accounting pass later upgrades WalletView. This absolute-final pass wires the active
// month and forces the dashboard cashbox card + WalletView header to use the exact same
// reset-aware reconciled balance.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let source = read(path);

  const subscriptionImport = "import { SubscriptionInfo } from '../SubscriptionStatusUI';";
  if (!source.includes("from '../../utils/authoritativeAccounting'")) {
    must(source.includes(subscriptionImport), 'MobileLayout subscription import missing');
    source = source.replace(
      subscriptionImport,
      `${subscriptionImport}\nimport { reconciledCashbox, summarizeSubscribers } from '../../utils/authoritativeAccounting';`
    );
  }

  if (!source.includes('  activeMonthId?: string;')) {
    must(source.includes('  pricingTiers: SubscriptionTierPricing[];'), 'MobileLayout pricing tiers prop missing');
    source = source.replace(
      '  pricingTiers: SubscriptionTierPricing[];',
      '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;'
    );
  }

  const componentStart = source.indexOf('export const MobileLayout: React.FC<MobileLayoutProps> = ({');
  const componentEnd = source.indexOf('\n}) => {', componentStart);
  must(componentStart >= 0 && componentEnd > componentStart, 'MobileLayout component signature missing');
  let componentSignature = source.slice(componentStart, componentEnd);
  if (!/\n\s*activeMonthId,/.test(componentSignature)) {
    must(/\n\s*pricingTiers,/.test(componentSignature), 'MobileLayout pricing tiers argument missing');
    componentSignature = componentSignature.replace(/(\n\s*pricingTiers,)/, '$1\n  activeMonthId,');
    source = source.slice(0, componentStart) + componentSignature + source.slice(componentEnd);
  }
  must(source.includes('auditLogs = [],'), 'MobileLayout audit logs argument missing');
  must(source.includes('walletResetTimestamp'), 'MobileLayout reset timestamp argument missing');

  const bodyAnchor = source.indexOf('\n}) => {', componentStart);
  const returnIndex = source.indexOf('\n  return (', bodyAnchor);
  must(bodyAnchor >= 0 && returnIndex > bodyAnchor, 'MobileLayout return missing');
  if (!source.includes('MOBILE_CASHBOX_SINGLE_SOURCE_V3')) {
    const calculation = `\n  // MOBILE_CASHBOX_SINGLE_SOURCE_V3\n  const mobileCashboxSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const mobileCashboxAmount = reconciledCashbox(\n    mobileCashboxSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,\n  );\n`;
    source = source.slice(0, returnIndex) + calculation + source.slice(returnIndex);
  }

  const dashboardInfo = getComponentBlock(source, '<MobileDashboard');
  let dashboardBlock = dashboardInfo.block
    .split('\n')
    .filter(line => !line.includes('cashboxAmount=') && !line.includes('activeMonthId='))
    .join('\n');
  const dashboardAnchor = 'onNavigateToTab={onTabChange}';
  must(dashboardBlock.includes(dashboardAnchor), 'MobileDashboard navigation prop missing');
  dashboardBlock = dashboardBlock.replace(
    dashboardAnchor,
    `${dashboardAnchor}\n            activeMonthId={activeMonthId}\n            cashboxAmount={mobileCashboxAmount}`
  );
  source = source.slice(0, dashboardInfo.start) + dashboardBlock + source.slice(dashboardInfo.end);

  const walletTab = source.indexOf("activeTab === 'wallet'");
  must(walletTab >= 0, 'mobile wallet route missing');
  const walletStart = source.indexOf('<WalletView', walletTab);
  const walletEnd = source.indexOf('/>', walletStart);
  must(walletStart >= 0 && walletEnd > walletStart, 'WalletView call missing from mobile layout');
  let walletBlock = source.slice(walletStart, walletEnd + 2);

  if (!walletBlock.includes('pricingTiers={pricingTiers}')) {
    must(walletBlock.includes('subscribers={subscribers}'), 'WalletView subscriber prop missing');
    walletBlock = walletBlock.replace(
      'subscribers={subscribers}',
      'subscribers={subscribers}\n              pricingTiers={pricingTiers}'
    );
  }
  if (!walletBlock.includes('activeMonthId={activeMonthId}')) {
    must(walletBlock.includes('pricingTiers={pricingTiers}'), 'WalletView pricing tiers insertion failed');
    walletBlock = walletBlock.replace(
      'pricingTiers={pricingTiers}',
      'pricingTiers={pricingTiers}\n              activeMonthId={activeMonthId}'
    );
  }

  source = source.slice(0, walletStart) + walletBlock + source.slice(walletEnd + 2);
  write(path, source);
}

// App owns the active monthly tariff. Pass that exact id into MobileLayout instead of
// letting the phone view infer a potentially different calendar month.
{
  const path = 'src/App.tsx';
  let source = read(path);
  const mobileStart = source.indexOf('<MobileLayout');
  const mobileEnd = source.indexOf('/>', mobileStart);
  must(mobileStart >= 0 && mobileEnd > mobileStart, 'App MobileLayout call missing');
  let mobileBlock = source.slice(mobileStart, mobileEnd + 2);

  if (!mobileBlock.includes('activeMonthId=')) {
    must(mobileBlock.includes('pricingTiers={pricingTiers}'), 'App MobileLayout pricing tiers prop missing');
    mobileBlock = mobileBlock.replace(
      'pricingTiers={pricingTiers}',
      'pricingTiers={pricingTiers}\n              activeMonthId={activeMonthRecord?.id}'
    );
  }
  source = source.slice(0, mobileStart) + mobileBlock + source.slice(mobileEnd + 2);
  write(path, source);
}

// The dashboard cashbox card must show the same reset-aware amount passed by MobileLayout.
// Do not replace the separate monthly collected card.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let source = read(path);
  const cashboxMarker = '      {/* 3. Cashbox */}';
  const cashboxStart = source.indexOf(cashboxMarker);
  const cashboxEnd = source.indexOf('      {/* 4.', cashboxStart);
  must(cashboxStart >= 0 && cashboxEnd > cashboxStart, 'MobileDashboard cashbox section missing');
  let cashboxSection = source.slice(cashboxStart, cashboxEnd);
  cashboxSection = cashboxSection.replace(
    '{formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}',
    '{formatCurrency(cashboxAmount, generatorSpecs.currency)}'
  );
  must(
    cashboxSection.includes('{formatCurrency(cashboxAmount, generatorSpecs.currency)}'),
    'dashboard cashbox is not bound to passed reconciled amount'
  );
  must(
    !cashboxSection.includes('{formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}'),
    'dashboard cashbox still uses unreconciled monthly collected total'
  );
  source = source.slice(0, cashboxStart) + cashboxSection + source.slice(cashboxEnd);
  write(path, source);
}

// Defensive compatibility belongs in the accounting helper rather than the WalletView
// destructuring list. This keeps lint -> build idempotent because the authoritative pass
// may rewrite WalletView's parameter list on every execution.
{
  const path = 'src/utils/authoritativeAccounting.ts';
  let source = read(path);
  const from = 'export function summarizeSubscribers(subscribers: Subscriber[], tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {';
  const to = 'export function summarizeSubscribers(subscribers: Subscriber[], tiers: SubscriptionTierPricing[] = [], activeMonthId = getMonthId()) {';
  if (source.includes(from)) source = source.replace(from, to);
  must(source.includes(to), 'defensive authoritative pricing fallback missing');
  write(path, source);
}

const layout = read('src/components/mobile/MobileLayout.tsx');
const app = read('src/App.tsx');
const wallet = read('src/components/WalletView.tsx');
const accounting = read('src/utils/authoritativeAccounting.ts');
const dashboard = read('src/components/mobile/MobileDashboard.tsx');

const walletTab = layout.indexOf("activeTab === 'wallet'");
const walletStart = layout.indexOf('<WalletView', walletTab);
const walletEnd = layout.indexOf('/>', walletStart);
const walletBlock = walletStart >= 0 && walletEnd > walletStart ? layout.slice(walletStart, walletEnd + 2) : '';

const dashboardStart = layout.indexOf('<MobileDashboard');
const dashboardEnd = layout.indexOf('/>', dashboardStart);
const dashboardBlock = dashboardStart >= 0 && dashboardEnd > dashboardStart ? layout.slice(dashboardStart, dashboardEnd + 2) : '';

const mobileStart = app.indexOf('<MobileLayout');
const mobileEnd = app.indexOf('/>', mobileStart);
const mobileBlock = mobileStart >= 0 && mobileEnd > mobileStart ? app.slice(mobileStart, mobileEnd + 2) : '';

const cashboxStart = dashboard.indexOf('      {/* 3. Cashbox */}');
const cashboxEnd = dashboard.indexOf('      {/* 4.', cashboxStart);
const dashboardCashboxSection =
  cashboxStart >= 0 && cashboxEnd > cashboxStart ? dashboard.slice(cashboxStart, cashboxEnd) : '';

must(layout.includes('MOBILE_CASHBOX_SINGLE_SOURCE_V3'), 'single-source mobile cashbox marker missing');
must(
  layout.includes('reconciledCashbox(\n    mobileCashboxSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,'),
  'mobile dashboard cashbox does not use WalletView reconciliation inputs'
);
must(dashboardBlock.includes('activeMonthId={activeMonthId}'), 'MobileDashboard active month is not wired');
must(dashboardBlock.includes('cashboxAmount={mobileCashboxAmount}'), 'MobileDashboard reconciled cashbox amount is not wired');
must(walletBlock.includes('pricingTiers={pricingTiers}'), 'final mobile wallet pricing tiers are not wired');
must(walletBlock.includes('activeMonthId={activeMonthId}'), 'final mobile wallet active month is not wired');
must(mobileBlock.includes('activeMonthId={activeMonthRecord?.id}'), 'App active month is not wired into MobileLayout');
must(wallet.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)'), 'authoritative wallet summary missing');
must(
  wallet.includes('reconciledCashbox(walletSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)'),
  'WalletView reconciled balance missing'
);
must(accounting.includes('tiers: SubscriptionTierPricing[] = []'), 'accounting pricing fallback missing');
must(dashboard.includes("onNavigateToTab('wallet')"), 'dashboard cashbox button lost its wallet route');
must(
  dashboardCashboxSection.includes('{formatCurrency(cashboxAmount, generatorSpecs.currency)}'),
  'dashboard cashbox display is not identical to the passed reconciled amount'
);

console.log('Mobile cashbox parity fixed: dashboard card and wallet header now share the same reset-aware reconciled balance and active month.');

import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (value, message) => {
  if (!value) throw new Error(`Mobile wallet runtime finalizer: ${message}`);
};

// The mobile wallet is injected by an older build-time compatibility patch, while the
// authoritative accounting pass later upgrades WalletView to require pricingTiers and
// activeMonthId. Wire those values after every other mutation so the wallet cannot crash
// from an undefined pricing list at runtime.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let source = read(path);

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
const mobileStart = app.indexOf('<MobileLayout');
const mobileEnd = app.indexOf('/>', mobileStart);
const mobileBlock = mobileStart >= 0 && mobileEnd > mobileStart ? app.slice(mobileStart, mobileEnd + 2) : '';

must(walletBlock.includes('pricingTiers={pricingTiers}'), 'final mobile wallet pricing tiers are not wired');
must(walletBlock.includes('activeMonthId={activeMonthId}'), 'final mobile wallet active month is not wired');
must(mobileBlock.includes('activeMonthId={activeMonthRecord?.id}'), 'App active month is not wired into MobileLayout');
must(wallet.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)'), 'authoritative wallet summary missing');
must(accounting.includes('tiers: SubscriptionTierPricing[] = []'), 'accounting pricing fallback missing');
must(dashboard.includes("onNavigateToTab('wallet')"), 'dashboard cashbox button lost its wallet route');

console.log('Mobile cashbox runtime fixed: pricing tiers and active month are wired end-to-end with an idempotent accounting fallback.');

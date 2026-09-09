import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Final financial parity: ${m}`); };

// -----------------------------------------------------------------------------
// Collector dashboard: use the exact same authoritative financial-row classifier as
// the owner dashboards. This is intentionally the last accounting mutation so a row
// cannot be "paid" for the collector while remaining partial/unpaid for the owner.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/POSQuickView.tsx';
  let s = read(p);

  if (!s.includes("import { getSubscriberFinancialRow } from '../utils/authoritativeAccounting';")) {
    const importAnchor = "import { calculateSubscriberBill } from '../utils/formatters';";
    must(s.includes(importAnchor), 'POS formatter import anchor missing');
    s = s.replace(importAnchor, `${importAnchor}\nimport { getSubscriberFinancialRow } from '../utils/authoritativeAccounting';`);
  }

  must(s.includes('  const collectibleSubscribers ='), 'collector billable scope missing');
  must(s.includes('activeMonthId'), 'collector active accounting month missing');

  const start = s.indexOf('  // COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1');
  const end = start >= 0 ? s.indexOf('\n\n  return (', start) : -1;
  must(start >= 0 && end > start, 'collector accounting block bounds missing');

  const replacement = `  // COLLECTOR_OWNER_ACCOUNTING_PARITY_V2
  // Same classifier used by MobileDashboard/DashboardView/WalletView. The collector
  // only narrows the population by assigned cabinets; payment status semantics stay identical.
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const collectorAccountingRows = collectibleSubscribers.map(sub => {
    const row = getSubscriberFinancialRow(sub, pricingTiers, activeMonthId);
    return {
      sub,
      billed: row.bill,
      collected: row.paid,
      outstanding: row.outstanding,
      status: row.status,
      isFree: row.isFree,
    };
  });
  type CollectorAccountingRow = (typeof collectorAccountingRows)[number];
  const collectorAccountingById = new Map<string, CollectorAccountingRow>(
    collectorAccountingRows.map(row => [row.sub.id, row] as const)
  );

  const cabinetAccountingRows = selectedLineFilter === 'all'
    ? collectorAccountingRows
    : collectorAccountingRows.filter(row => row.sub.lineId === selectedLineFilter);
  const dashboardAccountingRows = billingCycleActive ? cabinetAccountingRows : [];

  const totalCollected = dashboardAccountingRows.reduce((sum, row) => sum + row.collected, 0);
  const totalUnpaid = dashboardAccountingRows.reduce((sum, row) => sum + row.outstanding, 0);
  const dashboardPaidSubscribers = dashboardAccountingRows.filter(row =>
    row.status === 'paid' && row.outstanding === 0 && row.billed > 0
  );

  const paidSubscribersList = billingCycleActive ? filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && row.status === 'paid' && row.outstanding === 0 && row.billed > 0);
  }) : [];
  const unpaidSubscribersList = billingCycleActive ? filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && (row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'));
  }) : [];

  const activeTier = pricingTiers.find(t => t.type === 'normal')
    || pricingTiers.find(t => t.type !== 'free');
  const activeTierPrice = Math.max(0, Number(activeTier?.pricePerAmpere || 0));`;

  s = s.slice(0, start) + replacement + s.slice(end);

  must(s.includes('COLLECTOR_OWNER_ACCOUNTING_PARITY_V2'), 'collector-owner parity marker missing');
  must(s.includes("row.status === 'paid' && row.outstanding === 0 && row.billed > 0"), 'collector paid rule differs from owner paid rule');
  must(s.includes("row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'"), 'collector unpaid rule differs from owner unpaid rule');
  must(s.includes('{dashboardPaidSubscribers.length} مشترك'), 'collector paid headline is not authoritative');
  must(s.includes('const totalCollected = dashboardAccountingRows.reduce'), 'collector collected amount is not authoritative');
  must(s.includes('const totalUnpaid = dashboardAccountingRows.reduce'), 'collector outstanding amount is not authoritative');

  write(p, s);
}

// -----------------------------------------------------------------------------
// Owner dashboards: keep the authoritative accounting source while restoring the
// monthly-cycle invariant: with no live tariff, CURRENT-month dashboard counters and
// amounts are zero. Historical invoices remain preserved in reports/history.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(p);
  const start = s.indexOf('  // AUTHORITATIVE_FINANCE_V2');
  const end = start >= 0 ? s.indexOf('\n\n  const circleLength =', start) : -1;
  must(start >= 0 && end > start, 'mobile authoritative block missing');
  const block = `  // AUTHORITATIVE_FINANCE_V2
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const dashboardRowById = new Map(dashboardSummary.rows.map(row => [row.sub.id, row] as const));
  const isPaidThisMonth = (sub: Subscriber) => {
    const row = dashboardRowById.get(sub.id);
    return Boolean(row && row.status === 'paid' && row.outstanding === 0 && row.bill > 0);
  };
  const isUnpaidThisMonth = (sub: Subscriber) => {
    const row = dashboardRowById.get(sub.id);
    return Boolean(row && (row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'));
  };
  const totalSubscribers = subscribers.length;
  const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];
  const unpaidSubs = billingCycleActive ? subscribers.filter(isUnpaidThisMonth) : [];
  const totalCollectedRevenue = billingCycleActive ? dashboardSummary.collected : 0;
  const totalUnpaidDebt = billingCycleActive ? dashboardSummary.outstanding : 0;
  const currentMonthTotal = billingCycleActive ? dashboardSummary.monthTotal : 0;`;
  s = s.slice(0, start) + block + s.slice(end);
  write(p, s);
}

{
  const p = 'src/components/DashboardView.tsx';
  let s = read(p);
  const start = s.indexOf('  // AUTHORITATIVE_FINANCE_V2');
  const end = start >= 0 ? s.indexOf('\n\n  return (', start) : -1;
  must(start >= 0 && end > start, 'desktop authoritative block missing');
  const block = `  // AUTHORITATIVE_FINANCE_V2
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const totalCount = subscribers.length;
  const paidSubscribers = billingCycleActive ? dashboardSummary.paidSubscribers : [];
  const unpaidSubscribers = billingCycleActive ? dashboardSummary.unpaidSubscribers : [];
  const totalUnpaidDebt = billingCycleActive ? dashboardSummary.outstanding : 0;
  const totalCollectedRevenue = billingCycleActive
    ? reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)
    : 0;`;
  s = s.slice(0, start) + block + s.slice(end);
  write(p, s);
}

// -----------------------------------------------------------------------------
// Wallet/cashbox: older build mutations can add the authoritative calculation while
// missing its component destructuring. Repair the final component signature so opening
// the cashbox never hits an undefined pricingTiers/activeMonthId reference.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/WalletView.tsx';
  let s = read(p);

  if (!s.includes('SubscriptionTierPricing')) {
    s = s.replace(
      "import { Subscriber, Collector, AuditLogEntry } from '../types';",
      "import { Subscriber, Collector, AuditLogEntry, SubscriptionTierPricing } from '../types';"
    );
  }
  if (!s.includes('  pricingTiers: SubscriptionTierPricing[];')) {
    s = s.replace('  subscribers: Subscriber[];', '  subscribers: Subscriber[];\n  pricingTiers: SubscriptionTierPricing[];');
  }
  if (!s.includes('  activeMonthId?: string;')) {
    s = s.replace('  walletResetTimestamp?: string;', '  walletResetTimestamp?: string;\n  activeMonthId?: string;');
  }

  const componentStart = s.indexOf('export const WalletView: React.FC<WalletViewProps> = ({');
  const componentBody = componentStart >= 0 ? s.indexOf('\n}) => {', componentStart) : -1;
  must(componentStart >= 0 && componentBody > componentStart, 'WalletView component signature missing');
  let signature = s.slice(componentStart, componentBody);
  if (!/\n\s*pricingTiers,/.test(signature)) {
    signature = signature.replace(/(\n\s*subscribers,)/, '$1\n  pricingTiers,');
  }
  if (!/\n\s*activeMonthId,/.test(signature)) {
    signature = signature.replace(/(\n\s*walletResetTimestamp,)/, '$1\n  activeMonthId,');
  }
  s = s.slice(0, componentStart) + signature + s.slice(componentBody);

  must(/export const WalletView[\s\S]*?\n\s*pricingTiers,/.test(s), 'WalletView pricingTiers is not destructured');
  must(/export const WalletView[\s\S]*?\n\s*activeMonthId,/.test(s), 'WalletView activeMonthId is not destructured');
  write(p, s);
}

// -----------------------------------------------------------------------------
// Cross-interface release invariants. A production build fails instead of publishing
// if any older mutation restores conflicting accounting/payment/sync behavior.
// -----------------------------------------------------------------------------
{
  const ownerMobile = read('src/components/mobile/MobileDashboard.tsx');
  const ownerDesktop = read('src/components/DashboardView.tsx');
  const wallet = read('src/components/WalletView.tsx');
  const pos = read('src/components/POSQuickView.tsx');
  const pay = read('src/components/PaymentMethodModal.tsx');
  const subscriber = read('src/components/SubscriberModal.tsx');
  const receipt = read('src/components/InvoiceReceiptModal.tsx');
  const sync = read('src/lib/useGeneratorCloudSync.ts');
  const accounting = read('src/utils/authoritativeAccounting.ts');
  const mobileSubscribers = read('src/components/mobile/MobileSubscribers.tsx');

  must(ownerMobile.includes('summarizeSubscribers('), 'mobile owner dashboard not using authoritative accounting');
  must(ownerDesktop.includes('summarizeSubscribers('), 'desktop owner dashboard not using authoritative accounting');
  must(ownerMobile.includes('const billingCycleActive = pricingTiers.some'), 'mobile zero-tariff gate missing');
  must(ownerMobile.includes('const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];'), 'mobile paid counter not gated by live tariff');
  must(ownerMobile.includes('const currentMonthTotal = billingCycleActive'), 'mobile monthly total not gated by live tariff');
  must(ownerDesktop.includes('const billingCycleActive = pricingTiers.some'), 'desktop zero-tariff gate missing');
  must(ownerDesktop.includes('const paidSubscribers = billingCycleActive'), 'desktop paid counter not gated by live tariff');
  must(ownerDesktop.includes('const totalUnpaidDebt = billingCycleActive'), 'desktop unpaid amount not gated by live tariff');
  must(wallet.includes('summarizeSubscribers('), 'cashbox/wallet not using authoritative accounting');
  must(wallet.includes('pricingTiers,'), 'wallet missing pricing tiers binding');
  must(wallet.includes('activeMonthId,'), 'wallet missing active month binding');
  must(pos.includes('getSubscriberFinancialRow('), 'collector dashboard not using owner financial classifier');
  must(pos.includes('const billingCycleActive = pricingTiers.some'), 'collector zero-tariff gate missing');
  must(accounting.includes("r.status === 'paid' && r.outstanding === 0 && r.bill > 0"), 'owner paid classifier invariant missing');
  must(accounting.includes("r.outstanding > 0 || r.status === 'unpaid' || r.status === 'partial'"), 'owner unpaid classifier invariant missing');

  must(pay.includes('تسديد مخصص'), 'collector custom payment missing');
  must(pay.includes('تسديد مقطوع'), 'collector lump settlement missing');
  must(!pay.includes('<option value="free">'), 'collector free-payment option must remain hidden');
  must(pos.includes('COLLECTOR_LUMP_SETTLEMENT_V1'), 'collector lump settlement accounting missing');
  must(pos.includes('applyPaymentOldestFirst'), 'collector partial payment debt allocation missing');
  must(subscriber.includes('handleLumpSettlement'), 'owner lump settlement missing');
  must(subscriber.includes('MOLDATK_PRIOR_DEBT_ONBOARDING'), 'new-subscriber prior debt linking missing');
  must(subscriber.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'), 'new-subscriber zero-debt start missing');

  must(receipt.includes('Number(invoice.paidAmount || 0) > 0'), 'receipt can finalize without real received money');
  must(sync.includes('pendingPush.current = true'), 'sync race queue protection missing');
  must(sync.includes("table: 'generator_subscribers'"), 'subscriber realtime sync missing');
  must(sync.includes("table: 'generator_invoices'"), 'invoice realtime sync missing');
  must(sync.includes("table: 'generator_audit_logs'"), 'audit realtime sync missing');
  must(sync.includes('COLLECTOR_SYNC_FREE_GUARD_V2'), 'collector cloud exemption guard missing');
  must(!mobileSubscribers.includes('if (selectedSubscriber)'), 'redundant mobile subscriber page returned');
}

console.log('Final financial/interface parity passed: owner and collector share one paid/unpaid classifier; zero-tariff dashboard state, wallet bindings, payment, receipt and realtime-sync invariants are intact.');

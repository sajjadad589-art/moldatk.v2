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
  const collectorAccountingById = new Map(collectorAccountingRows.map(row => [row.sub.id, row]));

  const dashboardAccountingRows = selectedLineFilter === 'all'
    ? collectorAccountingRows
    : collectorAccountingRows.filter(row => row.sub.lineId === selectedLineFilter);

  const totalCollected = dashboardAccountingRows.reduce((sum, row) => sum + row.collected, 0);
  const totalUnpaid = dashboardAccountingRows.reduce((sum, row) => sum + row.outstanding, 0);
  const dashboardPaidSubscribers = dashboardAccountingRows.filter(row =>
    row.status === 'paid' && row.outstanding === 0 && row.billed > 0
  );

  const paidSubscribersList = filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && row.status === 'paid' && row.outstanding === 0 && row.billed > 0);
  });
  const unpaidSubscribersList = filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && (row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'));
  });

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
  must(wallet.includes('summarizeSubscribers('), 'cashbox/wallet not using authoritative accounting');
  must(pos.includes('getSubscriberFinancialRow('), 'collector dashboard not using owner financial classifier');
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

console.log('Final financial/interface parity passed: owner and collector share one paid/unpaid classifier; payment, receipt and realtime-sync invariants are intact.');

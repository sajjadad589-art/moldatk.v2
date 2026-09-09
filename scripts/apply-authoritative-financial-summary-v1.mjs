import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Authoritative finance: ${m}`); };
const ensureImport = (src, anchor, addition) => src.includes(addition) ? src : src.replace(anchor, `${anchor}\n${addition}`);

// One runtime source of truth for every monetary/card total.
write('src/utils/authoritativeAccounting.ts', `import type { AuditLogEntry, Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateSubscriberBill } from './formatters';
import { getInvoiceRemaining, getMonthId } from './monthlyAccounting';

export interface SubscriberFinancialRow {
  subscriber: Subscriber;
  isFree: boolean;
  bill: number;
  paid: number;
  outstanding: number;
  status: 'paid' | 'partial' | 'unpaid' | 'free';
}

const money = (value: unknown) => Math.max(0, Number(value) || 0);

function newestInvoice(invoices: SubscriberInvoice[]): SubscriberInvoice | undefined {
  return [...invoices].sort((a, b) => {
    const at = a.paymentDate || a.issueDate || '';
    const bt = b.paymentDate || b.issueDate || '';
    if (at !== bt) return bt.localeCompare(at);
    const ap = money(a.paidAmount);
    const bp = money(b.paidAmount);
    if (ap !== bp) return bp - ap;
    const ar = getInvoiceRemaining(a);
    const br = getInvoiceRemaining(b);
    if (ar !== br) return ar - br;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];
}

function canonicalInvoices(subscriber: Subscriber): SubscriberInvoice[] {
  const byMonth = new Map<string, SubscriberInvoice[]>();
  for (const inv of subscriber.invoicesHistory || []) {
    if (inv.status === 'cancelled' || inv.status === 'free') continue;
    const key = String(inv.monthId || 'legacy');
    const list = byMonth.get(key) || [];
    list.push(inv);
    byMonth.set(key, list);
  }
  return Array.from(byMonth.values()).map(list => newestInvoice(list)!).filter(Boolean);
}

export function getSubscriberFinancialRow(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  activeMonthId = getMonthId(),
): SubscriberFinancialRow {
  const isFree = subscriber.tier === 'free' || subscriber.isExempted === true || subscriber.paymentStatus === 'free';
  if (isFree) return { subscriber, isFree: true, bill: 0, paid: 0, outstanding: 0, status: 'free' };

  const invoices = canonicalInvoices(subscriber);
  const currentInvoice = newestInvoice(invoices.filter(inv => inv.monthId === activeMonthId));
  const tariffBill = money(calculateSubscriberBill(subscriber.amperes, subscriber.tier, pricingTiers).total);
  const invoiceBill = money(currentInvoice?.totalAmount);
  const invoicePaid = Math.min(invoiceBill || Number.MAX_SAFE_INTEGER, money(currentInvoice?.paidAmount));
  const legacyDue = money(subscriber.amountDue);
  const legacyPaid = money(subscriber.amountPaid);

  // Current monthly charge: tariff/current invoice are primary. Legacy paid rows are
  // allowed to raise the charge because older Moldatk versions stored the original
  // monthly bill in amountDue even after payment; this is the data visible on the
  // subscriber cards and must not disappear from dashboard totals during migration.
  let bill = Math.max(tariffBill, invoiceBill);
  if (subscriber.paymentStatus === 'paid') bill = Math.max(bill, legacyDue, legacyPaid);
  if (subscriber.paymentStatus === 'partial') {
    const legacyGross = legacyDue >= bill && legacyPaid > 0 ? legacyDue : legacyPaid + legacyDue;
    bill = Math.max(bill, legacyGross);
  }
  if (subscriber.paymentStatus === 'unpaid' && bill <= 0) bill = legacyDue;

  let status: SubscriberFinancialRow['status'];
  if (subscriber.paymentStatus === 'paid' || currentInvoice?.status === 'paid') status = 'paid';
  else if (subscriber.paymentStatus === 'partial' || currentInvoice?.status === 'partial' || invoicePaid > 0 || legacyPaid > 0) status = 'partial';
  else status = 'unpaid';

  let paid = 0;
  if (status === 'paid') paid = bill;
  else if (status === 'partial') paid = Math.min(bill, Math.max(invoicePaid, legacyPaid));

  const ledgerOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  let outstanding = 0;
  if (status === 'partial') {
    const legacyRemaining = legacyDue >= bill && legacyPaid > 0 ? Math.max(0, legacyDue - legacyPaid) : legacyDue;
    outstanding = Math.max(ledgerOutstanding, Math.max(0, bill - paid), legacyRemaining);
  } else if (status === 'unpaid') {
    outstanding = Math.max(ledgerOutstanding, legacyDue, bill);
  }

  return { subscriber, isFree: false, bill, paid, outstanding, status };
}

export function summarizeSubscribers(
  subscribers: Subscriber[],
  pricingTiers: SubscriptionTierPricing[],
  activeMonthId = getMonthId(),
) {
  const rows = subscribers.map(sub => getSubscriberFinancialRow(sub, pricingTiers, activeMonthId));
  const billableRows = rows.filter(r => !r.isFree);
  const paidRows = billableRows.filter(r => r.status === 'paid' && r.outstanding === 0);
  const unpaidRows = billableRows.filter(r => r.status === 'unpaid' || r.status === 'partial' || r.outstanding > 0);
  return {
    rows,
    billableRows,
    paidRows,
    unpaidRows,
    paidSubscribers: paidRows.map(r => r.subscriber),
    unpaidSubscribers: unpaidRows.map(r => r.subscriber),
    totalSubscribers: subscribers.length,
    collected: billableRows.reduce((sum, r) => sum + r.paid, 0),
    outstanding: billableRows.reduce((sum, r) => sum + r.outstanding, 0),
    monthTotal: billableRows.reduce((sum, r) => sum + r.bill, 0),
  };
}

function netAudit(logs: AuditLogEntry[]): number {
  const ordered = [...logs].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const stacks = new Map<string, number[]>();
  let payments = 0;
  let cancellations = 0;
  for (const log of ordered) {
    const key = String(log.entityId || 'unknown');
    if (log.category === 'payment') {
      const amount = money(log.amount);
      payments += amount;
      if (amount > 0) {
        const stack = stacks.get(key) || [];
        stack.push(amount);
        stacks.set(key, stack);
      }
      continue;
    }
    if (log.category !== 'cancellation') continue;
    const stack = stacks.get(key) || [];
    let amount = money(log.amount);
    if (!amount && stack.length) amount = stack.pop() || 0;
    else if (amount && stack.length) stack.pop();
    stacks.set(key, stack);
    cancellations += amount;
  }
  return Math.max(0, payments - cancellations);
}

export function getReconciledCashboxAmount(
  ledgerCollected: number,
  auditLogs: AuditLogEntry[] = [],
  walletResetTimestamp?: string,
  activeMonthId = getMonthId(),
): number {
  const collected = money(ledgerCollected);
  const currentMonthLogs = auditLogs.filter(log => {
    if (log.category !== 'payment' && log.category !== 'cancellation') return false;
    if (!log.timestamp) return false;
    const d = new Date(log.timestamp);
    return !Number.isNaN(d.getTime()) && getMonthId(d) === activeMonthId;
  });

  // With no reset, the subscriber ledger is authoritative; audit logs are a history
  // trail and are allowed to be incomplete on accounts migrated from older versions.
  if (!walletResetTimestamp) return collected;

  const auditWholeMonth = netAudit(currentMonthLogs);
  // A reset is trusted only when the audit trail reconciles to the ledger. If old
  // installations are missing payment logs, never let an incomplete log make the
  // cashbox smaller than the real collected amount.
  if (Math.abs(auditWholeMonth - collected) > 1) return collected;

  const resetMs = new Date(walletResetTimestamp).getTime();
  if (!Number.isFinite(resetMs)) return collected;
  return netAudit(currentMonthLogs.filter(log => new Date(log.timestamp || 0).getTime() >= resetMs));
}
`);

// Mobile owner dashboard: all three money cards and both counters from one summary.
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(p);
  s = ensureImport(s, "import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';", "import { summarizeSubscribers } from '../../utils/authoritativeAccounting';");
  if (!s.includes("from '../../utils/authoritativeAccounting'")) {
    const anchor = "import { calculateSubscriberBill, formatCurrency, formatNumberArabic } from '../../utils/formatters';";
    s = ensureImport(s, anchor, "import { summarizeSubscribers } from '../../utils/authoritativeAccounting';");
  }
  const start = s.indexOf('  const totalSubscribers = subscribers.length;');
  const end = s.indexOf('  const circleLength =', start);
  must(start >= 0 && end > start, 'MobileDashboard accounting bounds missing');
  const block = `  // AUTHORITATIVE_FINANCIAL_SUMMARY_V1\n  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const totalSubscribers = dashboardSummary.totalSubscribers;\n  const paidSubs = dashboardSummary.paidSubscribers;\n  const unpaidSubs = dashboardSummary.unpaidSubscribers;\n  const totalCollectedRevenue = dashboardSummary.collected;\n  const totalUnpaidDebt = dashboardSummary.outstanding;\n  const currentMonthTotal = dashboardSummary.monthTotal;\n\n`;
  s = s.slice(0, start) + block + s.slice(end);
  write(p, s);
}

// Mobile subscriber cards must display the exact same amounts used by the dashboard.
{
  const p = 'src/components/mobile/MobileSubscribers.tsx';
  let s = read(p);
  const importAnchor = "import { getSubscriberStyleByStatus } from '../SubscribersView';";
  s = ensureImport(s, importAnchor, "import { getSubscriberFinancialRow } from '../../utils/authoritativeAccounting';");
  if (!s.includes('  pricingTiers,\n  lines,')) {
    s = s.replace('  subscribers,\n  lines,', '  subscribers,\n  pricingTiers,\n  lines,');
  }
  if (!s.includes('  activeMonthId?: string;')) s = s.replace('  pricingTiers: SubscriptionTierPricing[];', '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;');
  if (!s.includes('  activeMonthId,\n  lines,')) s = s.replace('  pricingTiers,\n  lines,', '  pricingTiers,\n  activeMonthId,\n  lines,');
  const old = `            const visibleAmount = isFree\n              ? 'إعفاء'\n              : isPartial\n              ? formatCurrency(Math.max(0, Number(sub.amountDue || 0) - Number(sub.amountPaid || 0)))\n              : formatCurrency(Number(sub.amountDue || 0));`;
  must(s.includes(old), 'MobileSubscribers visible amount block missing');
  s = s.replace(old, `            const accountingRow = getSubscriberFinancialRow(sub, pricingTiers, activeMonthId);\n            const visibleAmount = isFree\n              ? 'إعفاء'\n              : formatCurrency(accountingRow.status === 'paid' ? accountingRow.bill : accountingRow.outstanding);`);
  write(p, s);
}

// Mobile layout cashbox: ledger first, reset only when audit history reconciles.
{
  const p = 'src/components/mobile/MobileLayout.tsx';
  let s = read(p);
  const typeImport = "import { SubscriptionInfo } from '../SubscriptionStatusUI';";
  s = ensureImport(s, typeImport, "import { getReconciledCashboxAmount, summarizeSubscribers } from '../../utils/authoritativeAccounting';");
  const marker = s.indexOf('  // DASHBOARD_CASHBOX_WALLETVIEW_PARITY_V3');
  const ret = marker >= 0 ? s.indexOf('  return (', marker) : -1;
  must(marker >= 0 && ret > marker, 'MobileLayout cashbox helper bounds missing');
  const helper = `  // AUTHORITATIVE_CASHBOX_RECONCILIATION_V1\n  const dashboardFinancialSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const dashboardCashboxAmount = getReconciledCashboxAmount(\n    dashboardFinancialSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,\n  );\n\n`;
  s = s.slice(0, marker) + helper + s.slice(ret);
  if (!s.includes('            activeMonthId={activeMonthId}\n            onTogglePaymentStatus')) {
    s = s.replace('            pricingTiers={pricingTiers}\n            lines={lines}', '            pricingTiers={pricingTiers}\n            activeMonthId={activeMonthId}\n            lines={lines}');
  }
  write(p, s);
}

// Desktop dashboard follows the same summary; cashbox uses reconciled ledger/audit rule.
{
  const p = 'src/components/DashboardView.tsx';
  let s = read(p);
  const formatImport = "import { formatCurrency } from '../utils/formatters';";
  s = ensureImport(s, formatImport, "import { getReconciledCashboxAmount, summarizeSubscribers } from '../utils/authoritativeAccounting';");
  if (!s.includes('  activeMonthId?: string;')) s = s.replace('  walletResetTimestamp?: string;', '  walletResetTimestamp?: string;\n  activeMonthId?: string;');
  if (!s.includes('  activeMonthId,\n  onOpenPricingModal')) s = s.replace('  walletResetTimestamp,\n  onOpenPricingModal', '  walletResetTimestamp,\n  activeMonthId,\n  onOpenPricingModal');
  const start = s.indexOf('  const totalCount = subscribers.length;');
  const ret = s.indexOf('  return (', start);
  must(start >= 0 && ret > start, 'DashboardView accounting bounds missing');
  const block = `  // AUTHORITATIVE_FINANCIAL_SUMMARY_V1\n  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const totalCount = dashboardSummary.totalSubscribers;\n  const paidSubscribers = dashboardSummary.paidSubscribers;\n  const unpaidSubscribers = dashboardSummary.unpaidSubscribers;\n  const totalUnpaidDebt = dashboardSummary.outstanding;\n  const totalCollectedRevenue = getReconciledCashboxAmount(\n    dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId\n  );\n\n`;
  s = s.slice(0, start) + block + s.slice(ret);
  s = s.replace(/\{paidSubscribers\.reduce\(\(sum, s\) => sum \+ \(Number\(s\.amountPaid\) \|\| 0\), 0\)\.toLocaleString\(\)\}/g, '{dashboardSummary.collected.toLocaleString()}');
  write(p, s);
}

// Wallet headline must never be lower than the reconciled subscriber ledger because of
// missing old audit rows. Transaction history remains untouched.
{
  const p = 'src/components/WalletView.tsx';
  let s = read(p);
  s = s.replace("import { Subscriber, Collector, AuditLogEntry } from '../types';", "import { Subscriber, Collector, AuditLogEntry, SubscriptionTierPricing } from '../types';");
  const typeAnchor = "import { Subscriber, Collector, AuditLogEntry, SubscriptionTierPricing } from '../types';";
  s = ensureImport(s, typeAnchor, "import { getReconciledCashboxAmount, summarizeSubscribers } from '../utils/authoritativeAccounting';");
  if (!s.includes('  pricingTiers: SubscriptionTierPricing[];')) s = s.replace('  subscribers: Subscriber[];', '  subscribers: Subscriber[];\n  pricingTiers: SubscriptionTierPricing[];');
  if (!s.includes('  activeMonthId?: string;')) s = s.replace('  walletResetTimestamp?: string;', '  walletResetTimestamp?: string;\n  activeMonthId?: string;');
  if (!s.includes('  pricingTiers,\n  collectors,')) s = s.replace('  subscribers,\n  collectors,', '  subscribers,\n  pricingTiers,\n  collectors,');
  if (!s.includes('  activeMonthId,\n  currency')) s = s.replace('  walletResetTimestamp,\n  currency', '  walletResetTimestamp,\n  activeMonthId,\n  currency');
  const ret = s.indexOf('  return (');
  must(ret >= 0, 'WalletView return missing');
  if (!s.includes('AUTHORITATIVE_WALLET_BALANCE_V1')) {
    const helper = `  // AUTHORITATIVE_WALLET_BALANCE_V1\n  const walletSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const authoritativeCashboxAmount = getReconciledCashboxAmount(\n    walletSummary.collected, auditLogs, walletResetTimestamp, activeMonthId\n  );\n\n`;
    s = s.slice(0, ret) + helper + s.slice(ret);
  }
  s = s.replace('{totalCollected.toLocaleString()} {currency}', '{authoritativeCashboxAmount.toLocaleString()} {currency}');
  write(p, s);
}

// App supplies the active accounting month to desktop surfaces and WalletView.
{
  const p = 'src/App.tsx';
  let s = read(p);
  if (!s.includes('              activeMonthId={activeMonthRecord?.id}\n              onOpenPricingModal')) {
    s = s.replace('              walletResetTimestamp={walletResetTimestamp}\n              onOpenPricingModal', '              walletResetTimestamp={walletResetTimestamp}\n              activeMonthId={activeMonthRecord?.id}\n              onOpenPricingModal');
  }
  if (!s.includes('              pricingTiers={pricingTiers}\n              collectors={collectors}')) {
    s = s.replace('            <WalletView\n              subscribers={subscribers}\n              collectors={collectors}', '            <WalletView\n              subscribers={subscribers}\n              pricingTiers={pricingTiers}\n              collectors={collectors}');
  }
  if (!s.includes('              activeMonthId={activeMonthRecord?.id}\n              currency={generatorSpecs.currency}')) {
    s = s.replace('              walletResetTimestamp={walletResetTimestamp}\n              currency={generatorSpecs.currency}', '              walletResetTimestamp={walletResetTimestamp}\n              activeMonthId={activeMonthRecord?.id}\n              currency={generatorSpecs.currency}');
  }
  write(p, s);
}

for (const [p, marker] of [
  ['src/components/mobile/MobileDashboard.tsx', 'AUTHORITATIVE_FINANCIAL_SUMMARY_V1'],
  ['src/components/mobile/MobileLayout.tsx', 'AUTHORITATIVE_CASHBOX_RECONCILIATION_V1'],
  ['src/components/DashboardView.tsx', 'AUTHORITATIVE_FINANCIAL_SUMMARY_V1'],
  ['src/components/WalletView.tsx', 'AUTHORITATIVE_WALLET_BALANCE_V1'],
]) must(read(p).includes(marker), `${p} marker missing`);

console.log('Authoritative financial summary applied: subscriber cards, dashboard totals and cashbox now reconcile to one ledger-derived source.');

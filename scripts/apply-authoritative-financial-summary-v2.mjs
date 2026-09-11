import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Authoritative finance v2: ${m}`); };
const addImportAfter = (src, anchor, line) => src.includes(line) ? src : (src.includes(anchor) ? src.replace(anchor, `${anchor}\n${line}`) : `${line}\n${src}`);

write('src/utils/authoritativeAccounting.ts', `import type { AuditLogEntry, Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateSubscriberBill } from './formatters';
import { getInvoiceRemaining, getMonthId } from './monthlyAccounting';

const n = (v: unknown) => Math.max(0, Number(v) || 0);

function newest(list: SubscriberInvoice[]): SubscriberInvoice | undefined {
  return [...list].sort((a, b) => {
    const ad = a.paymentDate || a.issueDate || '';
    const bd = b.paymentDate || b.issueDate || '';
    if (ad !== bd) return bd.localeCompare(ad);
    const ap = n(a.paidAmount), bp = n(b.paidAmount);
    if (ap !== bp) return bp - ap;
    const ar = getInvoiceRemaining(a), br = getInvoiceRemaining(b);
    if (ar !== br) return ar - br;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];
}

function canonicalInvoices(sub: Subscriber): SubscriberInvoice[] {
  const grouped = new Map<string, SubscriberInvoice[]>();
  for (const inv of sub.invoicesHistory || []) {
    if (inv.status === 'cancelled' || inv.status === 'free') continue;
    const key = String(inv.monthId || 'legacy');
    const list = grouped.get(key) || [];
    list.push(inv);
    grouped.set(key, list);
  }
  return Array.from(grouped.values()).map(x => newest(x)).filter(Boolean) as SubscriberInvoice[];
}

export function getSubscriberFinancialRow(sub: Subscriber, tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {
  const isFree = sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free';
  if (isFree) return { sub, isFree, bill: 0, paid: 0, outstanding: 0, status: 'free' as const };

  const invoices = canonicalInvoices(sub);
  const current = newest(invoices.filter(i => i.monthId === activeMonthId));
  const tariffBill = n(calculateSubscriberBill(sub.amperes, sub.tier, tiers).total);
  const invoiceBill = n(current?.totalAmount);
  const invoicePaid = n(current?.paidAmount);
  const legacyDue = n(sub.amountDue);
  const legacyPaid = n(sub.amountPaid);

  let bill = Math.max(tariffBill, invoiceBill);
  if (sub.paymentStatus === 'paid') bill = Math.max(bill, legacyDue, legacyPaid);
  else if (sub.paymentStatus === 'partial') {
    const legacyGross = legacyDue >= bill && legacyPaid > 0 ? legacyDue : legacyDue + legacyPaid;
    bill = Math.max(bill, legacyGross);
  } else if (bill <= 0) bill = legacyDue;

  let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
  if (sub.paymentStatus === 'paid' || current?.status === 'paid') status = 'paid';
  else if (sub.paymentStatus === 'partial' || current?.status === 'partial' || invoicePaid > 0 || legacyPaid > 0) status = 'partial';

  const paid = status === 'paid' ? bill : status === 'partial' ? Math.min(bill, Math.max(invoicePaid, legacyPaid)) : 0;
  const ledgerOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  let outstanding = 0;
  if (status === 'partial') {
    const legacyRemaining = legacyDue >= bill && legacyPaid > 0 ? Math.max(0, legacyDue - legacyPaid) : legacyDue;
    outstanding = Math.max(ledgerOutstanding, Math.max(0, bill - paid), legacyRemaining);
  } else if (status === 'unpaid') {
    outstanding = Math.max(ledgerOutstanding, legacyDue, bill);
  }
  return { sub, isFree, bill, paid, outstanding, status };
}

export function summarizeSubscribers(subscribers: Subscriber[], tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {
  const rows = subscribers.map(sub => getSubscriberFinancialRow(sub, tiers, activeMonthId));
  const billable = rows.filter(r => !r.isFree);
  const paidRows = billable.filter(r => r.status === 'paid' && r.outstanding === 0);
  const unpaidRows = billable.filter(r => r.status !== 'paid' || r.outstanding > 0);
  return {
    rows,
    totalSubscribers: subscribers.length,
    paidSubscribers: paidRows.map(r => r.sub),
    unpaidSubscribers: unpaidRows.map(r => r.sub),
    collected: billable.reduce((sum, r) => sum + r.paid, 0),
    outstanding: billable.reduce((sum, r) => sum + r.outstanding, 0),
    monthTotal: billable.reduce((sum, r) => sum + r.bill, 0),
  };
}

function net(logs: AuditLogEntry[]) {
  const ordered = [...logs].sort((a,b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const stacks = new Map<string, number[]>();
  let result = 0;
  for (const log of ordered) {
    const key = String(log.entityId || 'unknown');
    if (log.category === 'payment') {
      const amount = n(log.amount); result += amount;
      if (amount > 0) { const s = stacks.get(key) || []; s.push(amount); stacks.set(key, s); }
    } else if (log.category === 'cancellation') {
      const s = stacks.get(key) || [];
      let amount = n(log.amount);
      if (!amount && s.length) amount = s.pop() || 0; else if (amount && s.length) s.pop();
      stacks.set(key, s); result -= amount;
    }
  }
  return Math.max(0, result);
}

export function reconciledCashbox(collected: number, logs: AuditLogEntry[] = [], resetAt?: string, activeMonthId = getMonthId()) {
  const ledger = n(collected);
  if (!resetAt) return ledger;
  const monthLogs = logs.filter(log => {
    if ((log.category !== 'payment' && log.category !== 'cancellation') || !log.timestamp) return false;
    const d = new Date(log.timestamp);
    return !Number.isNaN(d.getTime()) && getMonthId(d) === activeMonthId;
  });
  const whole = net(monthLogs);
  // Old installations can have incomplete audit history. In that case the subscriber
  // ledger wins, otherwise a cashbox can silently under-report real collections.
  if (Math.abs(whole - ledger) > 1) return ledger;
  const resetMs = new Date(resetAt).getTime();
  if (!Number.isFinite(resetMs)) return ledger;
  return net(monthLogs.filter(log => new Date(log.timestamp || 0).getTime() >= resetMs));
}
`);

// Mobile dashboard: force every displayed figure to the same summary.
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(p);
  s = addImportAfter(s, "import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';", "import { summarizeSubscribers } from '../../utils/authoritativeAccounting';");
  if (!s.includes('AUTHORITATIVE_FINANCE_V2')) {
    const start = s.indexOf('  const totalSubscribers = subscribers.length;');
    const end = s.indexOf('  const circleLength =', start);
    must(start >= 0 && end > start, 'MobileDashboard accounting block missing');
    s = s.slice(0, start) + `  // AUTHORITATIVE_FINANCE_V2\n  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const totalSubscribers = dashboardSummary.totalSubscribers;\n  const paidSubs = dashboardSummary.paidSubscribers;\n  const unpaidSubs = dashboardSummary.unpaidSubscribers;\n  const totalCollectedRevenue = dashboardSummary.collected;\n  const totalUnpaidDebt = dashboardSummary.outstanding;\n  const currentMonthTotal = dashboardSummary.monthTotal;\n\n` + s.slice(end);
  }
  // Cashbox headline must match the real collected total if older audit rows are incomplete.
  s = s.replace('{formatCurrency(cashboxAmount, generatorSpecs.currency)}', '{formatCurrency(totalCollectedRevenue, generatorSpecs.currency)}');
  write(p, s);
}

// Desktop dashboard uses the same subscriber summary.
{
  const p = 'src/components/DashboardView.tsx';
  let s = read(p);
  s = addImportAfter(s, "import { formatCurrency } from '../utils/formatters';", "import { reconciledCashbox, summarizeSubscribers } from '../utils/authoritativeAccounting';");
  if (!s.includes('  activeMonthId?: string;')) s = s.replace('  walletResetTimestamp?: string;', '  walletResetTimestamp?: string;\n  activeMonthId?: string;');
  if (!s.includes('  activeMonthId,\n  onOpenPricingModal')) s = s.replace('  walletResetTimestamp,\n  onOpenPricingModal', '  walletResetTimestamp,\n  activeMonthId,\n  onOpenPricingModal');
  if (!s.includes('AUTHORITATIVE_FINANCE_V2')) {
    const start = s.indexOf('  const totalCount = subscribers.length;');
    const ret = s.indexOf('  return (', start);
    must(start >= 0 && ret > start, 'DashboardView accounting block missing');
    s = s.slice(0, start) + `  // AUTHORITATIVE_FINANCE_V2\n  const dashboardSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const totalCount = dashboardSummary.totalSubscribers;\n  const paidSubscribers = dashboardSummary.paidSubscribers;\n  const unpaidSubscribers = dashboardSummary.unpaidSubscribers;\n  const totalUnpaidDebt = dashboardSummary.outstanding;\n  const totalCollectedRevenue = reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId);\n\n` + s.slice(ret);
  }
  s = s.replace(/\{paidSubscribers\.reduce\([\s\S]*?\.toLocaleString\(\)\}/, '{dashboardSummary.collected.toLocaleString()}');
  write(p, s);
}

// Wallet visible balance is reconciled against the same ledger summary.
{
  const p = 'src/components/WalletView.tsx';
  let s = read(p);
  s = s.replace("import { Subscriber, Collector, AuditLogEntry } from '../types';", "import { Subscriber, Collector, AuditLogEntry, SubscriptionTierPricing } from '../types';");
  s = addImportAfter(s, "import { Subscriber, Collector, AuditLogEntry, SubscriptionTierPricing } from '../types';", "import { reconciledCashbox, summarizeSubscribers } from '../utils/authoritativeAccounting';");
  if (!s.includes('  pricingTiers: SubscriptionTierPricing[];')) s = s.replace('  subscribers: Subscriber[];', '  subscribers: Subscriber[];\n  pricingTiers: SubscriptionTierPricing[];');
  if (!s.includes('  activeMonthId?: string;')) s = s.replace('  walletResetTimestamp?: string;', '  walletResetTimestamp?: string;\n  activeMonthId?: string;');
  if (!s.includes('  pricingTiers,\n  collectors,')) s = s.replace('  subscribers,\n  collectors,', '  subscribers,\n  pricingTiers,\n  collectors,');
  if (!s.includes('  activeMonthId,\n  currency')) s = s.replace('  walletResetTimestamp,\n  currency', '  walletResetTimestamp,\n  activeMonthId,\n  currency');
  const ret = s.indexOf('  return (');
  must(ret >= 0, 'WalletView return missing');
  if (!s.includes('AUTHORITATIVE_WALLET_V2')) s = s.slice(0, ret) + `  // AUTHORITATIVE_WALLET_V2\n  const walletSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);\n  const authoritativeCashbox = reconciledCashbox(walletSummary.collected, auditLogs, walletResetTimestamp, activeMonthId);\n\n` + s.slice(ret);
  s = s.replace('{totalCollected.toLocaleString()} {currency}', '{authoritativeCashbox.toLocaleString()} {currency}');
  write(p, s);
}

// Supply current active tariff month and tiers to desktop dashboard/wallet.
{
  const p = 'src/App.tsx';
  let s = read(p);
  s = s.replace('              walletResetTimestamp={walletResetTimestamp}\n              onOpenPricingModal', '              walletResetTimestamp={walletResetTimestamp}\n              activeMonthId={activeMonthRecord?.id}\n              onOpenPricingModal');
  s = s.replace('            <WalletView\n              subscribers={subscribers}\n              collectors={collectors}', '            <WalletView\n              subscribers={subscribers}\n              pricingTiers={pricingTiers}\n              collectors={collectors}');
  s = s.replace('              walletResetTimestamp={walletResetTimestamp}\n              currency={generatorSpecs.currency}', '              walletResetTimestamp={walletResetTimestamp}\n              activeMonthId={activeMonthRecord?.id}\n              currency={generatorSpecs.currency}');
  write(p, s);
}

must(read('src/components/mobile/MobileDashboard.tsx').includes('AUTHORITATIVE_FINANCE_V2'), 'mobile marker missing');
must(read('src/components/WalletView.tsx').includes('AUTHORITATIVE_WALLET_V2'), 'wallet marker missing');
console.log('Authoritative finance v2 applied: paid total, unpaid total, monthly total and cashbox share one source of truth.');

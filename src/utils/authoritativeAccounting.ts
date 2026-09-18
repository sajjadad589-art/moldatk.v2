import type { AuditLogEntry, Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateMonthlyCharge, getInvoiceRemaining, getMonthId } from './monthlyAccounting';
import { hasMonthlyPricing } from './pricingAvailability';

const n = (v: unknown) => Math.max(0, Number(v) || 0);
const notes = (inv?: SubscriberInvoice) => String(inv?.notes || '');
const isNoCurrentCharge = (inv?: SubscriberInvoice) => notes(inv).includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');
const isLumpSettlement = (inv?: SubscriberInvoice) => notes(inv).includes('MOLDATK_LUMP_SETTLEMENT');

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
  if (!hasMonthlyPricing(tiers)) return { sub, isFree: false, bill: 0, paid: 0, outstanding: 0, status: 'no_tariff' as const };
  const isFree = sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free';
  if (isFree) return { sub, isFree, bill: 0, paid: 0, outstanding: 0, status: 'free' as const };

  const invoices = canonicalInvoices(sub);
  const current = newest(invoices.filter(i => i.monthId === activeMonthId));
  const ledgerOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const legacyDue = n(sub.amountDue);
  const legacyPaid = n(sub.amountPaid);

  // New subscriber added without a current-month charge: do not let the tariff engine
  // invent a debt. Older explicitly-linked debt remains visible and collectible.
  if (isNoCurrentCharge(current)) {
    const oldOutstanding = invoices.filter(inv => inv.monthId !== activeMonthId).reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const outstanding = Math.max(oldOutstanding, legacyDue);
    return { sub, isFree: false, bill: 0, paid: 0, outstanding, status: outstanding > 0 ? 'unpaid' as const : 'not_due' as const };
  }

  const tariffBill = n(calculateMonthlyCharge(sub, tiers).total);
  const invoiceBill = n(current?.totalAmount);
  const invoicePaid = n(current?.paidAmount);

  // Lump settlement is an owner-approved effective charge. Never expand it back to the
  // tariff amount: dashboard/month total/cashbox must reflect actual agreed money.
  if (isLumpSettlement(current)) {
    const bill = invoiceBill;
    const paid = Math.min(bill, invoicePaid);
    const outstanding = Math.max(ledgerOutstanding, legacyDue);
    return { sub, isFree: false, bill, paid, outstanding, status: outstanding > 0 ? 'partial' as const : 'paid' as const };
  }

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
  let outstanding = 0;
  if (status === 'partial') {
    const legacyRemaining = legacyDue >= bill && legacyPaid > 0 ? Math.max(0, legacyDue - legacyPaid) : legacyDue;
    outstanding = Math.max(ledgerOutstanding, Math.max(0, bill - paid), legacyRemaining);
  } else if (status === 'unpaid') {
    outstanding = Math.max(ledgerOutstanding, legacyDue, bill);
  }
  return { sub, isFree: false, bill, paid, outstanding, status };
}

export function summarizeSubscribers(subscribers: Subscriber[], tiers: SubscriptionTierPricing[] = [], activeMonthId = getMonthId()) {
  const rows = subscribers.map(sub => getSubscriberFinancialRow(sub, tiers, activeMonthId));
  const billable = rows.filter(r => !r.isFree);
  const paidRows = billable.filter(r => r.status === 'paid' && r.outstanding === 0 && r.bill > 0);
  const unpaidRows = billable.filter(r => r.outstanding > 0 || r.status === 'unpaid' || r.status === 'partial');
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
      if (amount > 0) { const stack = stacks.get(key) || []; stack.push(amount); stacks.set(key, stack); }
    } else if (log.category === 'cancellation') {
      const stack = stacks.get(key) || [];
      let amount = n(log.amount);
      if (!amount && stack.length) amount = stack.pop() || 0; else if (amount && stack.length) stack.pop();
      stacks.set(key, stack); result -= amount;
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
  if (Math.abs(whole - ledger) > 1) return ledger;
  const resetMs = new Date(resetAt).getTime();
  if (!Number.isFinite(resetMs)) return ledger;
  return net(monthLogs.filter(log => new Date(log.timestamp || 0).getTime() >= resetMs));
}

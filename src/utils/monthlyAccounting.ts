import type { Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';

export function getMonthId(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthNameAr(date = new Date()): string {
  const month = date.getMonth() + 1;
  const label = date.toLocaleDateString('ar-IQ-u-nu-latn', { month: 'long', year: 'numeric' });
  return `شهر ${month} (${label})`;
}

export function calculateMonthlyCharge(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
): { total: number; pricePerAmpere: number; fixedFee: number } {
  if (subscriber.tier === 'free' || subscriber.isExempted) {
    return { total: 0, pricePerAmpere: 0, fixedFee: 0 };
  }
  const tier = pricingTiers.find(t => t.type === subscriber.tier || t.id === subscriber.tier);
  const pricePerAmpere = Number(tier?.pricePerAmpere || 0);
  const fixedFee = Number(tier?.fixedFee || 0);
  return {
    total: Number(subscriber.amperes || 0) * pricePerAmpere + fixedFee,
    pricePerAmpere,
    fixedFee,
  };
}

export function getInvoiceRemaining(invoice: SubscriberInvoice): number {
  if (invoice.status === 'cancelled' || invoice.status === 'free') return 0;
  if (typeof invoice.remainingAmount === 'number') return Math.max(0, invoice.remainingAmount);
  return Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
}

export function getSubscriberDebt(subscriber: Subscriber, beforeMonthId?: string): number {
  const invoices = subscriber.invoicesHistory || [];
  const debt = invoices
    .filter(inv => !beforeMonthId || inv.monthId < beforeMonthId)
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  if (debt > 0) return debt;

  // Legacy fallback for subscribers that predate monthly invoices.
  if (!invoices.length) {
    return Math.max(0, Number(subscriber.amountDue || 0) - Number(subscriber.amountPaid || 0));
  }
  return 0;
}

export function ensureCurrentMonthInvoice(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  date = new Date(),
): { invoices: SubscriberInvoice[]; currentInvoice: SubscriberInvoice; carriedDebt: number } {
  const monthId = getMonthId(date);
  const monthNameAr = getMonthNameAr(date);
  const charge = calculateMonthlyCharge(subscriber, pricingTiers);
  const existing = [...(subscriber.invoicesHistory || [])];
  let currentInvoice = existing.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
  const carriedDebt = getSubscriberDebt(subscriber, monthId);

  if (!currentInvoice) {
    currentInvoice = {
      id: `inv-${monthId}-${subscriber.id}`,
      subscriberId: subscriber.id,
      receiptNumber: `ACC-${monthId}-${subscriber.code || subscriber.subscriberCode || subscriber.id}`,
      monthId,
      monthNameAr,
      issueDate: date.toISOString().split('T')[0],
      amperes: subscriber.amperes,
      tier: subscriber.tier,
      pricePerAmpere: charge.pricePerAmpere,
      fixedFee: charge.fixedFee,
      totalAmount: charge.total,
      paidAmount: 0,
      remainingAmount: charge.total,
      status: subscriber.tier === 'free' || subscriber.isExempted ? 'free' : 'unpaid',
      notes: carriedDebt > 0 ? `دين مرحل من أشهر سابقة: ${carriedDebt}` : undefined,
    };
    existing.push(currentInvoice);
  }

  return { invoices: existing, currentInvoice, carriedDebt };
}

export function applyPaymentOldestFirst(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  paymentAmount: number,
  date = new Date(),
): { invoices: SubscriberInvoice[]; totalDebtAfter: number; currentMonthRemaining: number } {
  const ensured = ensureCurrentMonthInvoice(subscriber, pricingTiers, date);
  const invoices = ensured.invoices.map(inv => ({ ...inv }));
  let remainingPayment = Math.max(0, Number(paymentAmount || 0));

  const payable = invoices
    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && getInvoiceRemaining(inv) > 0)
    .sort((a, b) => `${a.monthId}-${a.issueDate}-${a.id}`.localeCompare(`${b.monthId}-${b.issueDate}-${b.id}`));

  for (const invoice of payable) {
    if (remainingPayment <= 0) break;
    const due = getInvoiceRemaining(invoice);
    const applied = Math.min(due, remainingPayment);
    const nextPaid = Number(invoice.paidAmount || 0) + applied;
    const nextRemaining = Math.max(0, Number(invoice.totalAmount || 0) - nextPaid);
    invoice.paidAmount = nextPaid;
    invoice.remainingAmount = nextRemaining;
    invoice.paymentDate = date.toISOString();
    invoice.status = nextRemaining === 0 ? 'paid' : 'partial';
    remainingPayment -= applied;
  }

  const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const currentMonthRemaining = invoices
    .filter(inv => inv.monthId === getMonthId(date))
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

  return { invoices, totalDebtAfter, currentMonthRemaining };
}

export function buildMonthlyReports(subscribers: Subscriber[]) {
  const byMonth = new Map<string, {
    monthId: string;
    monthNameAr: string;
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    paidSubscribers: Set<string>;
    unpaidSubscribers: Set<string>;
    subscriberDebts: Array<{ subscriberId: string; name: string; code: string; debt: number }>;
  }>();

  for (const sub of subscribers) {
    for (const inv of sub.invoicesHistory || []) {
      if (inv.status === 'cancelled') continue;
      const report = byMonth.get(inv.monthId) || {
        monthId: inv.monthId,
        monthNameAr: inv.monthNameAr || inv.monthId,
        totalAmount: 0,
        paidAmount: 0,
        debtAmount: 0,
        paidSubscribers: new Set<string>(),
        unpaidSubscribers: new Set<string>(),
        subscriberDebts: [],
      };
      const remaining = getInvoiceRemaining(inv);
      report.totalAmount += Number(inv.totalAmount || 0);
      report.paidAmount += Number(inv.paidAmount || 0);
      report.debtAmount += remaining;
      if (remaining === 0) report.paidSubscribers.add(sub.id);
      else {
        report.unpaidSubscribers.add(sub.id);
        report.subscriberDebts.push({
          subscriberId: sub.id,
          name: sub.fullName,
          code: sub.code || sub.subscriberCode || '',
          debt: remaining,
        });
      }
      byMonth.set(inv.monthId, report);
    }
  }

  return [...byMonth.values()]
    .sort((a, b) => b.monthId.localeCompare(a.monthId))
    .map(r => ({
      ...r,
      paidCount: r.paidSubscribers.size,
      unpaidCount: r.unpaidSubscribers.size,
      subscriberDebts: r.subscriberDebts.sort((a, b) => b.debt - a.debt),
    }));
}

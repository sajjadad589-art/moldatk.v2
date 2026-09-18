import { hasMonthlyPricing } from '../utils/pricingAvailability';
import type {
  MonthlyTariffRecord,
  PaymentAllocationEntry,
  Subscriber,
  SubscriberInvoice,
  SubscriptionTierPricing,
} from '../types';

export function getMonthId(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthNameAr(date = new Date()): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export function monthIdToDate(monthId: string): Date {
  const [yearRaw, monthRaw] = String(monthId || '').split('-');
  const year = Number(yearRaw) || new Date().getFullYear();
  const month = Math.min(12, Math.max(1, Number(monthRaw) || 1));
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

// AMPERE_DISCOUNT_MONTHLY_ACCOUNTING_V1
export interface MonthlyChargeBreakdown {
  total: number;
  pricePerAmpere: number;
  fixedFee: number;
  originalAmperes: number;
  discountedAmperes: number;
  billedAmperes: number;
  grossTotal: number;
  discountAmount: number;
}

export function getSubscriberAmpereDiscount(subscriber: Subscriber): number {
  const original = Math.max(0, Number(subscriber.amperes || 0));
  const requested = Math.max(0, Number(subscriber.ampereDiscount || 0));
  return Math.min(original, requested);
}

export function getSubscriberBillableAmperes(subscriber: Subscriber): number {
  return Math.max(0, Math.max(0, Number(subscriber.amperes || 0)) - getSubscriberAmpereDiscount(subscriber));
}

export function calculateMonthlyCharge(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
): MonthlyChargeBreakdown {
  const originalAmperes = Math.max(0, Number(subscriber.amperes || 0));

  if (subscriber.tier === 'free' || subscriber.isExempted) {
    return {
      total: 0,
      pricePerAmpere: 0,
      fixedFee: 0,
      originalAmperes,
      discountedAmperes: 0,
      billedAmperes: 0,
      grossTotal: 0,
      discountAmount: 0,
    };
  }

  const tier = pricingTiers.find(t => t.type === subscriber.tier || t.id === subscriber.tier);
  const pricePerAmpere = Math.max(0, Number(tier?.pricePerAmpere || 0));
  const fixedFee = Math.max(0, Number(tier?.fixedFee || 0));
  const discountedAmperes = getSubscriberAmpereDiscount(subscriber);
  const billedAmperes = Math.max(0, originalAmperes - discountedAmperes);
  const grossTotal = Math.max(0, originalAmperes * pricePerAmpere + fixedFee);
  const discountAmount = Math.max(0, discountedAmperes * pricePerAmpere);
  const total = Math.max(0, billedAmperes * pricePerAmpere + fixedFee);

  return {
    total,
    pricePerAmpere,
    fixedFee,
    originalAmperes,
    discountedAmperes,
    billedAmperes,
    grossTotal,
    discountAmount,
  };
}

export function getInvoiceRemaining(invoice: SubscriberInvoice): number {
  if (invoice.status === 'cancelled' || invoice.status === 'free') return 0;
  if (typeof invoice.remainingAmount === 'number') return Math.max(0, Number(invoice.remainingAmount || 0));
  return Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
}

export function getSubscriberDebt(subscriber: Subscriber, beforeMonthId?: string): number {
  const invoices = (subscriber.invoicesHistory || []).filter(inv => inv.status !== 'cancelled');
  const debt = invoices
    .filter(inv => !beforeMonthId || inv.monthId < beforeMonthId)
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

  if (invoices.length) return Math.max(0, debt);

  // Backward-compatible fallback for accounts created before monthly invoices existed.
  if (!beforeMonthId) return Math.max(0, Number(subscriber.amountDue || 0));
  return Math.max(0, Number(subscriber.amountDue || 0) - Number(subscriber.amountPaid || 0));
}

function canonicalInvoiceForMonth(invoices: SubscriberInvoice[]): SubscriberInvoice | null {
  if (!invoices.length) return null;
  return [...invoices].sort((a, b) => {
    const aTime = a.paymentDate || a.issueDate || '';
    const bTime = b.paymentDate || b.issueDate || '';
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    const aPaid = Number(a.paidAmount || 0);
    const bPaid = Number(b.paidAmount || 0);
    if (aPaid !== bPaid) return bPaid - aPaid;
    return b.id.localeCompare(a.id);
  })[0] || null;
}

export function activateMonthlyTariffForSubscribers(
  subscribers: Subscriber[],
  previousActiveRecord: MonthlyTariffRecord | undefined,
  activeRecord: MonthlyTariffRecord,
  now = new Date(),
): Subscriber[] {
  return subscribers.map(sub => {
    const isFree = sub.tier === 'free' || sub.isExempted;
    const history = [...(sub.invoicesHistory || [])].map(inv => ({ ...inv }));

    // FREE_INVOICE_INTEGRITY_V1
    if (isFree) {
      for (const inv of history) {
        if (inv.status === 'cancelled') continue;
        inv.tier = 'free';
        inv.pricePerAmpere = 0;
        inv.fixedFee = 0;
        inv.totalAmount = 0;
        inv.paidAmount = 0;
        inv.remainingAmount = 0;
        inv.status = 'free';
      }
    }

    // Backfill the closing month only when the account still comes from the legacy summary fields.
    if (
      previousActiveRecord &&
      previousActiveRecord.id !== activeRecord.id &&
      !history.some(inv => inv.monthId === previousActiveRecord.id && inv.status !== 'cancelled')
    ) {
      const previousCharge = calculateMonthlyCharge(sub, previousActiveRecord.tiers);
      const previousTotal = isFree ? 0 : previousCharge.total;
      const previousPaid = isFree
        ? 0
        : sub.paymentStatus === 'paid'
        ? previousTotal
        : sub.paymentStatus === 'partial'
        ? Math.min(previousTotal, Math.max(0, Number(sub.amountPaid || 0)))
        : 0;
      const previousRemaining = Math.max(0, previousTotal - previousPaid);

      history.push({
        id: `inv-${previousActiveRecord.id}-${sub.id}`,
        subscriberId: sub.id,
        receiptNumber: `ACC-${previousActiveRecord.id}-${sub.code || sub.subscriberCode || sub.id}`,
        monthId: previousActiveRecord.id,
        monthNameAr: previousActiveRecord.monthNameAr || getMonthNameAr(monthIdToDate(previousActiveRecord.id)),
        issueDate: previousActiveRecord.createdAt || now.toISOString().slice(0, 10),
        paymentDate: previousPaid > 0 ? sub.lastPaymentDate : undefined,
        amperes: sub.amperes,
        originalAmperes: previousCharge.originalAmperes,
        discountedAmperes: previousCharge.discountedAmperes,
        billedAmperes: previousCharge.billedAmperes,
        grossAmountBeforeDiscount: previousCharge.grossTotal,
        discountAmount: previousCharge.discountAmount,
        tier: sub.tier,
        pricePerAmpere: previousCharge.pricePerAmpere,
        fixedFee: previousCharge.fixedFee,
        totalAmount: previousTotal,
        paidAmount: previousPaid,
        remainingAmount: previousRemaining,
        status: isFree ? 'free' : previousRemaining === 0 ? 'paid' : previousPaid > 0 ? 'partial' : 'unpaid',
      });
    }

    const charge = calculateMonthlyCharge(sub, activeRecord.tiers);
    const sameMonthInvoices = history.filter(inv => inv.monthId === activeRecord.id && inv.status !== 'cancelled');
    let currentInvoice = canonicalInvoiceForMonth(sameMonthInvoices);

    if (!currentInvoice) {
      const previousDebt = history
        .filter(inv => inv.monthId < activeRecord.id)
        .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

      currentInvoice = {
        id: `inv-${activeRecord.id}-${sub.id}`,
        subscriberId: sub.id,
        receiptNumber: `ACC-${activeRecord.id}-${sub.code || sub.subscriberCode || sub.id}`,
        monthId: activeRecord.id,
        monthNameAr: activeRecord.monthNameAr || getMonthNameAr(monthIdToDate(activeRecord.id)),
        issueDate: now.toISOString().slice(0, 10),
        amperes: sub.amperes,
        originalAmperes: charge.originalAmperes,
        discountedAmperes: isFree ? 0 : charge.discountedAmperes,
        billedAmperes: isFree ? 0 : charge.billedAmperes,
        grossAmountBeforeDiscount: isFree ? 0 : charge.grossTotal,
        discountAmount: isFree ? 0 : charge.discountAmount,
        tier: sub.tier,
        pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
        fixedFee: isFree ? 0 : charge.fixedFee,
        totalAmount: isFree ? 0 : charge.total,
        paidAmount: 0,
        remainingAmount: isFree ? 0 : charge.total,
        status: isFree ? 'free' : charge.total <= 0 ? 'paid' : 'unpaid',
        notes: previousDebt > 0 ? `دين مرحل من أشهر سابقة: ${previousDebt}` : undefined,
      };
      history.push(currentInvoice);
    } else if (currentInvoice.status !== 'paid' && currentInvoice.status !== 'free') {
      // A price edit in the active month updates only the unpaid portion of that same month.
      // Historical/fully-paid months are frozen and never recomputed.
      const alreadyPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));
      currentInvoice.amperes = sub.amperes;
      currentInvoice.originalAmperes = charge.originalAmperes;
      currentInvoice.discountedAmperes = isFree ? 0 : charge.discountedAmperes;
      currentInvoice.billedAmperes = isFree ? 0 : charge.billedAmperes;
      currentInvoice.grossAmountBeforeDiscount = isFree ? 0 : charge.grossTotal;
      currentInvoice.discountAmount = isFree ? 0 : charge.discountAmount;
      currentInvoice.tier = sub.tier;
      currentInvoice.monthNameAr = activeRecord.monthNameAr || currentInvoice.monthNameAr;
      currentInvoice.pricePerAmpere = isFree ? 0 : charge.pricePerAmpere;
      currentInvoice.fixedFee = isFree ? 0 : charge.fixedFee;
      currentInvoice.totalAmount = isFree ? 0 : charge.total;
      currentInvoice.paidAmount = isFree ? 0 : Math.min(alreadyPaid, charge.total);
      currentInvoice.remainingAmount = isFree ? 0 : Math.max(0, charge.total - currentInvoice.paidAmount);
      currentInvoice.status = isFree
        ? 'free'
        : currentInvoice.remainingAmount === 0
        ? 'paid'
        : currentInvoice.paidAmount > 0
        ? 'partial'
        : 'unpaid';
    }

    const totalOutstanding = history.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const currentRemaining = getInvoiceRemaining(currentInvoice);
    const currentPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));

    // The dashboard/card status is the ACTIVE MONTH status. Old debt remains in amountDue
    // and in the payment allocation flow, but it must not make a brand-new month look paid/partial.
    const currentStatus: Subscriber['paymentStatus'] = currentInvoice.status === 'free'
      ? 'free'
      : currentRemaining === 0
      ? 'paid'
      : currentPaid > 0
      ? 'partial'
      : 'unpaid';

    return {
      ...sub,
      invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: currentPaid,
      paymentStatus: currentStatus,
    };
  });
}

export function ensureMonthInvoice(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  monthId: string,
  monthNameAr?: string,
  issueDate?: string,
): { invoices: SubscriberInvoice[]; currentInvoice: SubscriberInvoice; carriedDebt: number } {
  const charge = calculateMonthlyCharge(subscriber, pricingTiers);
  const existing = [...(subscriber.invoicesHistory || [])].map(inv => ({ ...inv }));
  const freeSubscriber = subscriber.tier === 'free' || subscriber.isExempted === true || subscriber.paymentStatus === 'free';
  if (freeSubscriber) {
    for (const inv of existing) {
      if (inv.status === 'cancelled') continue;
      inv.tier = 'free';
      inv.pricePerAmpere = 0;
      inv.fixedFee = 0;
      inv.totalAmount = 0;
      inv.paidAmount = 0;
      inv.remainingAmount = 0;
      inv.status = 'free';
    }
  }
  let currentInvoice = canonicalInvoiceForMonth(existing.filter(inv => inv.monthId === monthId && inv.status !== 'cancelled'));
  const carriedDebt = existing
    .filter(inv => inv.monthId < monthId)
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

  if (!currentInvoice) {
    const dateForName = monthIdToDate(monthId);
    const isFree = subscriber.tier === 'free' || subscriber.isExempted;
    currentInvoice = {
      id: `inv-${monthId}-${subscriber.id}`,
      subscriberId: subscriber.id,
      receiptNumber: `ACC-${monthId}-${subscriber.code || subscriber.subscriberCode || subscriber.id}`,
      monthId,
      monthNameAr: monthNameAr || getMonthNameAr(dateForName),
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      amperes: subscriber.amperes,
      originalAmperes: charge.originalAmperes,
      discountedAmperes: isFree ? 0 : charge.discountedAmperes,
      billedAmperes: isFree ? 0 : charge.billedAmperes,
      grossAmountBeforeDiscount: isFree ? 0 : charge.grossTotal,
      discountAmount: isFree ? 0 : charge.discountAmount,
      tier: subscriber.tier,
      pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
      fixedFee: isFree ? 0 : charge.fixedFee,
      totalAmount: isFree ? 0 : charge.total,
      paidAmount: 0,
      remainingAmount: isFree ? 0 : charge.total,
      status: isFree ? 'free' : charge.total <= 0 ? 'paid' : 'unpaid',
      notes: carriedDebt > 0 ? `دين مرحل من أشهر سابقة: ${carriedDebt}` : undefined,
    };
    existing.push(currentInvoice);
  }

  return { invoices: existing, currentInvoice, carriedDebt };
}

export function ensureCurrentMonthInvoice(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  date = new Date(),
): { invoices: SubscriberInvoice[]; currentInvoice: SubscriberInvoice; carriedDebt: number } {
  return ensureMonthInvoice(subscriber, pricingTiers, getMonthId(date), getMonthNameAr(date), date.toISOString().slice(0, 10));
}

export interface OldestFirstPaymentResult {
  invoices: SubscriberInvoice[];
  totalDebtBefore: number;
  totalDebtAfter: number;
  carriedDebtBefore: number;
  currentMonthCharge: number;
  currentMonthRemaining: number;
  appliedToPreviousDebt: number;
  appliedToCurrentMonth: number;
  allocations: PaymentAllocationEntry[];
}

export function applyPaymentOldestFirst(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  paymentAmount: number,
  date = new Date(),
  activeMonthId = getMonthId(date),
  activeMonthNameAr = getMonthNameAr(monthIdToDate(activeMonthId)),
): OldestFirstPaymentResult {
  if (!hasMonthlyPricing(pricingTiers)) throw new Error('NO_MONTHLY_TARIFF');
  const ensured = ensureMonthInvoice(
    subscriber,
    pricingTiers,
    activeMonthId,
    activeMonthNameAr,
    date.toISOString().slice(0, 10),
  );
  const invoices = ensured.invoices.map(inv => ({ ...inv }));
  const totalDebtBefore = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const carriedDebtBefore = invoices
    .filter(inv => inv.monthId < activeMonthId)
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const currentMonthCharge = invoices
    .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

  let remainingPayment = Math.min(Math.max(0, Number(paymentAmount || 0)), totalDebtBefore);
  const allocations: PaymentAllocationEntry[] = [];

  const payable = invoices
    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && getInvoiceRemaining(inv) > 0)
    .sort((a, b) => `${a.monthId}-${a.issueDate}-${a.id}`.localeCompare(`${b.monthId}-${b.issueDate}-${b.id}`));

  for (const invoice of payable) {
    if (remainingPayment <= 0) break;
    const due = getInvoiceRemaining(invoice);
    const applied = Math.min(due, remainingPayment);
    if (applied <= 0) continue;

    const nextPaid = Number(invoice.paidAmount || 0) + applied;
    const nextRemaining = Math.max(0, Number(invoice.totalAmount || 0) - nextPaid);
    invoice.paidAmount = nextPaid;
    invoice.remainingAmount = nextRemaining;
    invoice.paymentDate = date.toISOString();
    invoice.status = nextRemaining === 0 ? 'paid' : 'partial';
    allocations.push({ monthId: invoice.monthId, monthNameAr: invoice.monthNameAr, amount: applied });
    remainingPayment -= applied;
  }

  const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const currentMonthRemaining = invoices
    .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const appliedToPreviousDebt = allocations
    .filter(item => item.monthId < activeMonthId)
    .reduce((sum, item) => sum + item.amount, 0);
  const appliedToCurrentMonth = allocations
    .filter(item => item.monthId === activeMonthId)
    .reduce((sum, item) => sum + item.amount, 0);

  // Keep a human-readable allocation trail in the current invoice's notes so it survives
  // the existing cloud schema without requiring a destructive migration.
  const currentInvoice = canonicalInvoiceForMonth(invoices.filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled'));
  if (currentInvoice && allocations.length) {
    const allocationText = allocations.map(a => `${a.monthId}:${a.amount}`).join(',');
    const baseNote = (currentInvoice.notes || '').replace(/(?:\s*\|\s*)?توزيع آخر دفعة:[^|]*/g, '').trim();
    currentInvoice.notes = `${baseNote}${baseNote ? ' | ' : ''}توزيع آخر دفعة:${allocationText}`;
  }

  return {
    invoices,
    totalDebtBefore,
    totalDebtAfter,
    carriedDebtBefore,
    currentMonthCharge,
    currentMonthRemaining,
    appliedToPreviousDebt,
    appliedToCurrentMonth,
    allocations,
  };
}

interface MonthlySubscriberRow {
  subscriberId: string;
  name: string;
  code: string;
  amperes: number;
  total: number;
  paid: number;
  remaining: number;
  status: 'paid' | 'partial' | 'unpaid' | 'free';
}

export interface MonthlyReport {
  monthId: string;
  monthNameAr: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  totalSubscribers: number;
  totalAmperes: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  freeCount: number;
  carriedDebtOut: number;
  subscribers: MonthlySubscriberRow[];
  paidSubscribers: MonthlySubscriberRow[];
  partialSubscribers: MonthlySubscriberRow[];
  unpaidSubscribers: MonthlySubscriberRow[];
  freeSubscribers: MonthlySubscriberRow[];
  subscriberDebts: Array<{ subscriberId: string; name: string; code: string; debt: number }>;
}

export function buildMonthlyReports(subscribers: Subscriber[]): MonthlyReport[] {
  const monthBuckets = new Map<string, { monthNameAr: string; bySubscriber: Map<string, SubscriberInvoice[]> }>();

  for (const sub of subscribers) {
    for (const inv of sub.invoicesHistory || []) {
      if (inv.status === 'cancelled') continue;
      const bucket = monthBuckets.get(inv.monthId) || {
        monthNameAr: inv.monthNameAr || inv.monthId,
        bySubscriber: new Map<string, SubscriberInvoice[]>(),
      };
      const list = bucket.bySubscriber.get(sub.id) || [];
      list.push(inv);
      bucket.bySubscriber.set(sub.id, list);
      if (!bucket.monthNameAr && inv.monthNameAr) bucket.monthNameAr = inv.monthNameAr;
      monthBuckets.set(inv.monthId, bucket);
    }
  }

  const reports: MonthlyReport[] = [];

  for (const [monthId, bucket] of monthBuckets.entries()) {
    const rows: MonthlySubscriberRow[] = [];

    for (const sub of subscribers) {
      const canonical = canonicalInvoiceForMonth(bucket.bySubscriber.get(sub.id) || []);
      if (!canonical) continue;
      const remaining = getInvoiceRemaining(canonical);
      const paid = Math.max(0, Number(canonical.paidAmount || 0));
      const isFree = canonical.status === 'free';
      const status: MonthlySubscriberRow['status'] = isFree
        ? 'free'
        : remaining === 0
        ? 'paid'
        : paid > 0
        ? 'partial'
        : 'unpaid';

      rows.push({
        subscriberId: sub.id,
        name: sub.fullName,
        code: sub.code || sub.subscriberCode || '',
        amperes: Number(canonical.amperes || sub.amperes || 0),
        total: Number(canonical.totalAmount || 0),
        paid,
        remaining,
        status,
      });
    }

    const paidSubscribers = rows.filter(r => r.status === 'paid');
    const partialSubscribers = rows.filter(r => r.status === 'partial');
    const unpaidSubscribers = rows.filter(r => r.status === 'unpaid');
    const freeSubscribers = rows.filter(r => r.status === 'free');

    const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);
    const paidAmount = rows.reduce((sum, r) => sum + r.paid, 0);
    const debtAmount = rows.reduce((sum, r) => sum + r.remaining, 0);

    reports.push({
      monthId,
      monthNameAr: bucket.monthNameAr || getMonthNameAr(monthIdToDate(monthId)),
      totalAmount,
      paidAmount,
      debtAmount,
      totalSubscribers: rows.length,
      totalAmperes: rows.reduce((sum, r) => sum + r.amperes, 0),
      paidCount: paidSubscribers.length,
      partialCount: partialSubscribers.length,
      unpaidCount: unpaidSubscribers.length,
      freeCount: freeSubscribers.length,
      carriedDebtOut: debtAmount,
      subscribers: rows,
      paidSubscribers,
      partialSubscribers,
      unpaidSubscribers,
      freeSubscribers,
      subscriberDebts: rows
        .filter(r => r.remaining > 0)
        .map(r => ({ subscriberId: r.subscriberId, name: r.name, code: r.code, debt: r.remaining }))
        .sort((a, b) => b.debt - a.debt),
    });
  }

  return reports.sort((a, b) => b.monthId.localeCompare(a.monthId));
}


export interface LumpSettlementAllDebtResult {
  invoices: SubscriberInvoice[];
  totalDebtBefore: number;
  receivedAmount: number;
  waivedAmount: number;
  allocations: PaymentAllocationEntry[];
}

export function applyLumpSettlementAllDebt(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  paymentAmount: number,
  date = new Date(),
  activeMonthId = getMonthId(date),
  activeMonthNameAr = getMonthNameAr(monthIdToDate(activeMonthId)),
): LumpSettlementAllDebtResult {
  if (!hasMonthlyPricing(pricingTiers)) throw new Error('NO_MONTHLY_TARIFF');
  const ensured = ensureMonthInvoice(subscriber, pricingTiers, activeMonthId, activeMonthNameAr, date.toISOString().slice(0, 10));
  const invoices = ensured.invoices.map(inv => ({ ...inv }));
  const payable = invoices
    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && getInvoiceRemaining(inv) > 0)
    .sort((a, b) => (a.monthId + '-' + a.issueDate + '-' + a.id).localeCompare(b.monthId + '-' + b.issueDate + '-' + b.id));
  const ledgerDebt = payable.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const totalDebtBefore = Math.max(ledgerDebt, Math.max(0, Number(subscriber.amountDue || 0)));
  const requested = Math.max(0, Math.round(Number(paymentAmount) || 0));
  if (totalDebtBefore <= 0) throw new Error('NO_OUTSTANDING_DEBT');
  if (requested < 1 || requested > totalDebtBefore) throw new Error('INVALID_LUMP_AMOUNT');

  let cashLeft = requested;
  const allocations: PaymentAllocationEntry[] = [];
  for (const invoice of payable) {
    const due = getInvoiceRemaining(invoice);
    if (due <= 0) continue;
    const cashApplied = Math.min(due, cashLeft);
    const paidBefore = Math.max(0, Number(invoice.paidAmount || 0));
    const paidAfter = paidBefore + cashApplied;
    const waivedHere = Math.max(0, due - cashApplied);
    const originalTotal = Math.max(0, Number(invoice.totalAmount || 0));
    const cleanNotes = String(invoice.notes || '').split(' | ').filter(x => x && !x.includes('MOLDATK_LUMP_SETTLEMENT_ALL_DEBT')).join(' | ');
    const marker = 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT|original=' + originalTotal + '|paidBefore=' + paidBefore + '|received=' + cashApplied + '|waived=' + waivedHere + '|settlementCash=' + requested + '|totalDebtBefore=' + totalDebtBefore;
    invoice.totalAmount = paidAfter;
    invoice.paidAmount = paidAfter;
    invoice.remainingAmount = 0;
    invoice.remainingAfterPayment = 0;
    invoice.status = 'paid';
    if (cashApplied > 0) invoice.paymentDate = date.toISOString();
    invoice.notes = [cleanNotes, marker].filter(Boolean).join(' | ');
    if (cashApplied > 0) {
      allocations.push({ monthId: invoice.monthId, monthNameAr: invoice.monthNameAr, amount: cashApplied });
      cashLeft -= cashApplied;
    }
  }

  // Legacy summary-only debt: keep actual received cash auditable on the active invoice,
  // while the negotiated settlement still closes the stale summary balance.
  if (cashLeft > 0) {
    const current = invoices.find(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled' && inv.status !== 'free');
    if (current) {
      current.totalAmount = Math.max(0, Number(current.totalAmount || 0)) + cashLeft;
      current.paidAmount = Math.max(0, Number(current.paidAmount || 0)) + cashLeft;
      current.remainingAmount = 0;
      current.remainingAfterPayment = 0;
      current.status = 'paid';
      current.paymentDate = date.toISOString();
      current.notes = [String(current.notes || ''), 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT|legacyCash=' + cashLeft].filter(Boolean).join(' | ');
      allocations.push({ monthId: current.monthId, monthNameAr: current.monthNameAr, amount: cashLeft });
      cashLeft = 0;
    }
  }

  return {
    invoices,
    totalDebtBefore,
    receivedAmount: requested,
    waivedAmount: Math.max(0, totalDebtBefore - requested),
    allocations,
  };
}

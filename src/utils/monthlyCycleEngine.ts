import type { MonthlyTariffRecord, Subscriber, SubscriberInvoice } from '../types';
import { calculateMonthlyCharge, getInvoiceRemaining } from './monthlyAccounting';

const canonicalMonthId = (year: number, month: number) =>
  `${Math.max(2000, Number(year || new Date().getFullYear()))}-${String(Math.min(12, Math.max(1, Number(month || 1)))).padStart(2, '0')}`;

const cloneInvoice = (invoice: SubscriberInvoice): SubscriberInvoice => ({ ...invoice });

const canonicalInvoiceForMonth = (history: SubscriberInvoice[], monthId: string): SubscriberInvoice | null => {
  const matches = history.filter(inv => inv.monthId === monthId && inv.status !== 'cancelled');
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const aPaid = Number(a.paidAmount || 0);
    const bPaid = Number(b.paidAmount || 0);
    if (aPaid !== bPaid) return bPaid - aPaid;
    const aDate = a.paymentDate || a.issueDate || '';
    const bDate = b.paymentDate || b.issueDate || '';
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return b.id.localeCompare(a.id);
  })[0] || null;
};

const totalOutstandingThroughMonth = (history: SubscriberInvoice[], monthId: string) =>
  history
    .filter(inv => inv.status !== 'cancelled' && inv.monthId <= monthId)
    .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

const currentStatusFromInvoice = (
  invoice: SubscriberInvoice | null,
  isFree: boolean,
): Subscriber['paymentStatus'] => {
  if (isFree || invoice?.status === 'free') return 'free';
  if (!invoice) return 'unpaid';
  const remaining = getInvoiceRemaining(invoice);
  const paid = Math.max(0, Number(invoice.paidAmount || 0));
  if (remaining === 0 && Number(invoice.totalAmount || 0) > 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
};

export function normalizeMonthlyTariffs(
  records: MonthlyTariffRecord[],
  activeMonthId: string,
  now = new Date(),
): MonthlyTariffRecord[] {
  const activeRecordInput = records.find(r => r.id === activeMonthId);
  const canonicalActiveId = activeRecordInput
    ? canonicalMonthId(activeRecordInput.year, activeRecordInput.month)
    : activeMonthId;

  const map = new Map<string, MonthlyTariffRecord>();
  for (const raw of records) {
    const month = Math.min(12, Math.max(1, Number(raw.month || 1)));
    const year = Math.max(2000, Number(raw.year || now.getFullYear()));
    const id = canonicalMonthId(year, month);
    map.set(id, {
      ...raw,
      id,
      month,
      year,
      monthNameAr: raw.monthNameAr || `${month}-${year}`,
      tiers: (raw.tiers || []).map(tier => ({ ...tier, fixedFee: Number(tier.fixedFee || 0) })),
      createdAt: raw.createdAt || now.toISOString().slice(0, 10),
      updatedAt: now.toISOString(),
      isCurrentActive: Boolean(canonicalActiveId && id === canonicalActiveId),
    });
  }

  return [...map.values()].sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

function backfillPreviousCycleIfNeeded(
  subscriber: Subscriber,
  history: SubscriberInvoice[],
  previousActiveRecord: MonthlyTariffRecord | undefined,
  now: Date,
): SubscriberInvoice[] {
  if (!previousActiveRecord) return history;
  if (history.some(inv => inv.monthId === previousActiveRecord.id && inv.status !== 'cancelled')) return history;

  const isFree = subscriber.tier === 'free' || Boolean(subscriber.isExempted);
  const charge = calculateMonthlyCharge(subscriber, previousActiveRecord.tiers || []);
  const total = isFree ? 0 : charge.total;
  const legacyPaid = isFree
    ? 0
    : subscriber.paymentStatus === 'paid'
    ? total
    : subscriber.paymentStatus === 'partial'
    ? Math.min(total, Math.max(0, Number(subscriber.amountPaid || 0)))
    : 0;

  // Do not manufacture meaningless "paid 0" historical invoices.
  if (total <= 0 && legacyPaid <= 0 && Number(subscriber.amountDue || 0) <= 0) return history;

  const remaining = Math.max(0, total - legacyPaid);
  return [
    ...history,
    {
      id: `inv-${previousActiveRecord.id}-${subscriber.id}`,
      subscriberId: subscriber.id,
      receiptNumber: `ACC-${previousActiveRecord.id}-${subscriber.code || subscriber.subscriberCode || subscriber.id}`,
      monthId: previousActiveRecord.id,
      monthNameAr: previousActiveRecord.monthNameAr || previousActiveRecord.id,
      issueDate: previousActiveRecord.createdAt || now.toISOString().slice(0, 10),
      paymentDate: legacyPaid > 0 ? subscriber.lastPaymentDate : undefined,
      amperes: subscriber.amperes,
      tier: subscriber.tier,
      pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
      fixedFee: isFree ? 0 : charge.fixedFee,
      totalAmount: total,
      paidAmount: legacyPaid,
      remainingAmount: remaining,
      status: isFree ? 'free' : remaining === 0 && total > 0 ? 'paid' : legacyPaid > 0 ? 'partial' : 'unpaid',
    },
  ];
}

export function startFreshMonthlyCycle(
  subscribers: Subscriber[],
  previousActiveRecord: MonthlyTariffRecord | undefined,
  activeRecord: MonthlyTariffRecord,
  now = new Date(),
): Subscriber[] {
  return subscribers.map(subscriber => {
    let history = (subscriber.invoicesHistory || []).map(cloneInvoice);
    history = backfillPreviousCycleIfNeeded(subscriber, history, previousActiveRecord, now);

    // A month that has no tariff record yet may contain orphan invoices left by an old bug.
    // A genuinely new monthly cycle must always start from zero, so remove those non-cancelled orphans.
    history = history.filter(inv => inv.monthId !== activeRecord.id || inv.status === 'cancelled');

    const isFree = subscriber.tier === 'free' || Boolean(subscriber.isExempted);
    const charge = calculateMonthlyCharge(subscriber, activeRecord.tiers || []);
    const previousDebt = history
      .filter(inv => inv.status !== 'cancelled' && inv.monthId < activeRecord.id)
      .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

    const currentInvoice: SubscriberInvoice = {
      id: `inv-${activeRecord.id}-${subscriber.id}`,
      subscriberId: subscriber.id,
      receiptNumber: `ACC-${activeRecord.id}-${subscriber.code || subscriber.subscriberCode || subscriber.id}`,
      monthId: activeRecord.id,
      monthNameAr: activeRecord.monthNameAr || activeRecord.id,
      issueDate: now.toISOString().slice(0, 10),
      amperes: subscriber.amperes,
      tier: subscriber.tier,
      pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
      fixedFee: isFree ? 0 : charge.fixedFee,
      totalAmount: isFree ? 0 : charge.total,
      paidAmount: 0,
      remainingAmount: isFree ? 0 : charge.total,
      status: isFree ? 'free' : 'unpaid',
      notes: previousDebt > 0 ? `دين سابق مرحل: ${previousDebt}` : undefined,
    };

    history.push(currentInvoice);
    const totalOutstanding = totalOutstandingThroughMonth(history, activeRecord.id);

    return {
      ...subscriber,
      invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: 0,
      paymentStatus: isFree ? 'free' : 'unpaid',
    };
  });
}

export function repriceActiveMonthlyCycle(
  subscribers: Subscriber[],
  activeRecord: MonthlyTariffRecord,
  now = new Date(),
): Subscriber[] {
  return subscribers.map(subscriber => {
    const isFree = subscriber.tier === 'free' || Boolean(subscriber.isExempted);
    let history = (subscriber.invoicesHistory || []).map(cloneInvoice);
    let currentInvoice = canonicalInvoiceForMonth(history, activeRecord.id);

    // Keep only one live invoice for the active month. Historical months are untouched.
    if (currentInvoice) {
      history = history.filter(inv =>
        inv.monthId !== activeRecord.id || inv.status === 'cancelled' || inv.id === currentInvoice!.id
      );
    }

    const charge = calculateMonthlyCharge(subscriber, activeRecord.tiers || []);
    if (!currentInvoice) {
      currentInvoice = {
        id: `inv-${activeRecord.id}-${subscriber.id}`,
        subscriberId: subscriber.id,
        receiptNumber: `ACC-${activeRecord.id}-${subscriber.code || subscriber.subscriberCode || subscriber.id}`,
        monthId: activeRecord.id,
        monthNameAr: activeRecord.monthNameAr || activeRecord.id,
        issueDate: now.toISOString().slice(0, 10),
        amperes: subscriber.amperes,
        tier: subscriber.tier,
        pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
        fixedFee: isFree ? 0 : charge.fixedFee,
        totalAmount: isFree ? 0 : charge.total,
        paidAmount: 0,
        remainingAmount: isFree ? 0 : charge.total,
        status: isFree ? 'free' : 'unpaid',
      };
      history.push(currentInvoice);
    } else {
      const alreadyPaid = isFree ? 0 : Math.max(0, Number(currentInvoice.paidAmount || 0));
      const nextTotal = isFree ? 0 : charge.total;
      const nextPaid = isFree ? 0 : Math.min(alreadyPaid, nextTotal);
      const nextRemaining = isFree ? 0 : Math.max(0, nextTotal - nextPaid);
      Object.assign(currentInvoice, {
        monthNameAr: activeRecord.monthNameAr || currentInvoice.monthNameAr,
        amperes: subscriber.amperes,
        tier: subscriber.tier,
        pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,
        fixedFee: isFree ? 0 : charge.fixedFee,
        totalAmount: nextTotal,
        paidAmount: nextPaid,
        remainingAmount: nextRemaining,
        status: isFree ? 'free' : nextRemaining === 0 && nextTotal > 0 ? 'paid' : nextPaid > 0 ? 'partial' : 'unpaid',
      });
    }

    const totalOutstanding = totalOutstandingThroughMonth(history, activeRecord.id);
    return {
      ...subscriber,
      invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: Math.max(0, Number(currentInvoice.paidAmount || 0)),
      paymentStatus: currentStatusFromInvoice(currentInvoice, isFree),
    };
  });
}

export function summarizeExistingMonthlyCycle(
  subscribers: Subscriber[],
  activeRecord: MonthlyTariffRecord,
): Subscriber[] {
  return subscribers.map(subscriber => {
    const isFree = subscriber.tier === 'free' || Boolean(subscriber.isExempted);
    let history = (subscriber.invoicesHistory || []).map(cloneInvoice);
    const currentInvoice = canonicalInvoiceForMonth(history, activeRecord.id);

    if (currentInvoice) {
      history = history.filter(inv =>
        inv.monthId !== activeRecord.id || inv.status === 'cancelled' || inv.id === currentInvoice.id
      );
    }

    return {
      ...subscriber,
      invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstandingThroughMonth(history, activeRecord.id),
      amountPaid: Math.max(0, Number(currentInvoice?.paidAmount || 0)),
      paymentStatus: currentStatusFromInvoice(currentInvoice, isFree),
    };
  });
}

export function zeroLiveMonthlyCycle(subscribers: Subscriber[]): Subscriber[] {
  return subscribers.map(subscriber => ({
    ...subscriber,
    amountDue: 0,
    amountPaid: 0,
    paymentStatus: subscriber.tier === 'free' || Boolean(subscriber.isExempted) ? 'free' : 'unpaid',
  }));
}

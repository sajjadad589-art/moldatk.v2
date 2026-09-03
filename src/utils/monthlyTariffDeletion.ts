import type { Subscriber, SubscriberInvoice } from '../types';
import { getInvoiceRemaining } from './monthlyAccounting';

function canonicalForMonth(invoices: SubscriberInvoice[], monthId: string): SubscriberInvoice | null {
  const matches = invoices.filter(inv => inv.monthId === monthId && inv.status !== 'cancelled');
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const aTime = a.paymentDate || a.issueDate || '';
    const bTime = b.paymentDate || b.issueDate || '';
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return Number(b.paidAmount || 0) - Number(a.paidAmount || 0);
  })[0] || null;
}

export function hasPaymentsInMonth(subscribers: Subscriber[], monthId: string): boolean {
  return subscribers.some(sub =>
    (sub.invoicesHistory || []).some(inv =>
      inv.monthId === monthId &&
      inv.status !== 'cancelled' &&
      inv.status !== 'free' &&
      Number(inv.paidAmount || 0) > 0
    )
  );
}

/**
 * Removes an accidentally-created active month only when it has no payments.
 * Previous months, historical receipts and carried debt remain intact.
 */
export function removeUnpaidMonthLedger(
  subscribers: Subscriber[],
  monthIdToRemove: string,
  nextActiveMonthId: string,
): Subscriber[] {
  if (hasPaymentsInMonth(subscribers, monthIdToRemove)) {
    throw new Error('MONTH_HAS_PAYMENTS');
  }

  return subscribers.map(sub => {
    const remainingHistory = (sub.invoicesHistory || [])
      .filter(inv => inv.monthId !== monthIdToRemove)
      .map(inv => ({ ...inv }));

    const nextCurrent = canonicalForMonth(remainingHistory, nextActiveMonthId);
    const totalOutstanding = remainingHistory.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const currentPaid = Math.max(0, Number(nextCurrent?.paidAmount || 0));
    const currentRemaining = nextCurrent ? getInvoiceRemaining(nextCurrent) : totalOutstanding;

    const paymentStatus: Subscriber['paymentStatus'] = nextCurrent?.status === 'free'
      ? 'free'
      : nextCurrent && currentRemaining === 0
      ? 'paid'
      : nextCurrent && currentPaid > 0
      ? 'partial'
      : 'unpaid';

    return {
      ...sub,
      invoicesHistory: remainingHistory.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: currentPaid,
      paymentStatus,
    };
  });
}

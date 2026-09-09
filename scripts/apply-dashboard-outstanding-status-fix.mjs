import fs from 'node:fs';

const path = 'src/components/mobile/MobileDashboard.tsx';
if (!fs.existsSync(path)) throw new Error('Dashboard outstanding fix: MobileDashboard.tsx missing');

let source = fs.readFileSync(path, 'utf8');

// On the second lint->build pass, the newer authoritative-finance finalizer already
// owns paid/unpaid semantics. Preserve it rather than requiring the older currentAccount
// helper that no longer exists in that final form.
const authoritativeDashboard =
  source.includes('AUTHORITATIVE_FINANCE_V2') &&
  source.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)') &&
  source.includes('const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];') &&
  source.includes('const unpaidSubs = billingCycleActive');

if (!authoritativeDashboard) {
  // Keep the dashboard tied to an active monthly tariff, but when a tariff is active
  // classify subscribers from their real live outstanding balance. This preserves the
  // zero-state required when all tariffs are deleted without regressing real unpaid counts.
  const paidStart = source.indexOf('  const paidSubs =');
  const collectedStart = paidStart >= 0 ? source.indexOf('  const totalCollectedRevenue =', paidStart) : -1;
  if (paidStart < 0 || collectedStart < 0 || collectedStart <= paidStart) {
    throw new Error('Dashboard outstanding fix: paid/unpaid block not found');
  }
  if (!source.includes('  const billingCycleActive = pricingTiers.some')) {
    throw new Error('Dashboard outstanding fix: billing-cycle guard missing');
  }
  if (!source.includes('  const currentAccount = (sub: Subscriber) =>')) {
    throw new Error('Dashboard outstanding fix: current-month account helper missing');
  }

  const statusBlock = `  // DASHBOARD_OUTSTANDING_STATUS_SINGLE_SOURCE_V3\n  const hasOutstandingBalance = (sub: Subscriber) => {\n    if (sub.tier === 'free' || sub.isExempted || sub.paymentStatus === 'free') return false;\n    return sub.paymentStatus === 'unpaid'\n      || sub.paymentStatus === 'partial'\n      || Math.max(0, Number(sub.amountDue || 0)) > 0;\n  };\n\n  const isPaidThisMonth = (sub: Subscriber) => {\n    if (sub.tier === 'free' || sub.isExempted || sub.paymentStatus === 'free') return false;\n    const invoice = currentAccount(sub);\n    if (invoice) return invoice.status !== 'free' && getInvoiceRemaining(invoice) === 0 && !hasOutstandingBalance(sub);\n    return legacyPaymentIsThisMonth(sub) && sub.paymentStatus === 'paid' && !hasOutstandingBalance(sub);\n  };\n\n  const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];\n  const unpaidSubs = billingCycleActive\n    ? subscribers.filter(hasOutstandingBalance)\n    : [];\n\n`;

  source = source.slice(0, paidStart) + statusBlock + source.slice(collectedStart);

  // Revenue and current-month totals must be zero when there is no active tariff.
  const collectedLine = '  const totalCollectedRevenue = currentMonthRows.reduce((sum, row) => sum + row.paid, 0);';
  if (source.includes(collectedLine)) {
    source = source.replace(
      collectedLine,
      '  const totalCollectedRevenue = billingCycleActive ? currentMonthRows.reduce((sum, row) => sum + row.paid, 0) : 0;'
    );
  }

  const oldDebtLine = '  const totalUnpaidDebt = currentMonthRows.reduce((sum, row) => sum + row.remaining, 0);';
  const newDebtBlock = `  // amountDue is the documented total outstanding balance across all monthly invoices.\n  const totalUnpaidDebt = billingCycleActive\n    ? unpaidSubs.reduce(\n        (sum, sub) => sum + Math.max(0, Number(sub.amountDue || 0)),\n        0\n      )\n    : 0;`;

  if (source.includes(oldDebtLine)) {
    source = source.replace(oldDebtLine, newDebtBlock);
  } else {
    const debtStart = source.indexOf('  const totalUnpaidDebt =');
    const monthTotalStart = debtStart >= 0 ? source.indexOf('  const currentMonthTotal =', debtStart) : -1;
    if (debtStart < 0 || monthTotalStart < 0 || monthTotalStart <= debtStart) {
      throw new Error('Dashboard outstanding fix: totalUnpaidDebt block not found');
    }
    source = source.slice(0, debtStart) + newDebtBlock + '\n' + source.slice(monthTotalStart);
  }

  const currentMonthLine = '  const currentMonthTotal = currentMonthRows.reduce((sum, row) => sum + row.due, 0);';
  if (source.includes(currentMonthLine)) {
    source = source.replace(
      currentMonthLine,
      '  const currentMonthTotal = billingCycleActive ? currentMonthRows.reduce((sum, row) => sum + row.due, 0) : 0;'
    );
  } else if (!source.includes('  const currentMonthTotal = billingCycleActive')) {
    throw new Error('Dashboard outstanding fix: current-month total guard missing');
  }

  if (!source.includes('DASHBOARD_OUTSTANDING_STATUS_SINGLE_SOURCE_V3')) {
    throw new Error('Dashboard outstanding fix: marker missing');
  }
  if (!source.includes('const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];')) {
    throw new Error('Dashboard outstanding fix: paid status must be gated by the active tariff');
  }
  if (!source.includes('const unpaidSubs = billingCycleActive')) {
    throw new Error('Dashboard outstanding fix: unpaid status must be gated by the active tariff');
  }
  if (!source.includes('const totalUnpaidDebt = billingCycleActive')) {
    throw new Error('Dashboard outstanding fix: unpaid amount must be gated by the active tariff');
  }
  if (!source.includes('const currentMonthTotal = billingCycleActive')) {
    throw new Error('Dashboard outstanding fix: monthly total must be gated by the active tariff');
  }
} else {
  console.log('skip: dashboard outstanding V3 block; authoritative finance already active');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Dashboard keeps zero state without a tariff and real paid/unpaid balances when the monthly cycle is active.');

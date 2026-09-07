import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// Final mobile dashboard accounting pass. Paid count, unpaid count, collected,
// remaining, and current-month total all come from one per-subscriber snapshot.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let source = read(path);

  if (!source.includes('getMonthId')) {
    source = source.replace(
      "import { getInvoiceRemaining } from '../../utils/monthlyAccounting';",
      "import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';"
    );
  }

  const currentAccountStart = source.indexOf('  const currentAccount = (sub: Subscriber) =>');
  const previousGuard = currentAccountStart >= 0
    ? source.lastIndexOf('  const billingCycleActive = pricingTiers.some', currentAccountStart)
    : -1;
  const start = previousGuard >= 0 ? previousGuard : currentAccountStart;
  const end = source.indexOf('  const circleLength =', currentAccountStart);
  if (start < 0 || currentAccountStart < 0 || end < 0) {
    throw new Error('Dashboard consistency v2: accounting bounds not found');
  }

  const block = `  // DASHBOARD_MONTH_ACCOUNTING_SINGLE_SOURCE_V2\n  const billingCycleActive = pricingTiers.some(t =>\n    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)\n  );\n\n  const currentAccount = (sub: Subscriber) => {\n    if (!billingCycleActive) return undefined;\n    return (sub.invoicesHistory || [])\n      .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')\n      .sort((a, b) => {\n        const aTime = a.paymentDate || a.issueDate || '';\n        const bTime = b.paymentDate || b.issueDate || '';\n        if (aTime !== bTime) return bTime.localeCompare(aTime);\n        const aPaid = Number(a.paidAmount || 0);\n        const bPaid = Number(b.paidAmount || 0);\n        if (aPaid !== bPaid) return bPaid - aPaid;\n        return String(b.id || '').localeCompare(String(a.id || ''));\n      })[0];\n  };\n\n  const legacyPaymentIsThisMonth = (sub: Subscriber) => {\n    if (!billingCycleActive || !sub.lastPaymentDate) return false;\n    const d = new Date(sub.lastPaymentDate);\n    return !Number.isNaN(d.getTime()) && getMonthId(d) === activeMonthId;\n  };\n\n  const currentMonthRows = billingCycleActive ? subscribers.map(sub => {\n    const invoice = currentAccount(sub);\n    const isFree = invoice?.status === 'free' || sub.tier === 'free' || Boolean(sub.isExempted);\n    const due = isFree ? 0 : Math.max(0, invoice\n      ? Number(invoice.totalAmount || 0)\n      : Number(calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));\n    const rawPaid = invoice\n      ? Math.max(0, Number(invoice.paidAmount || 0))\n      : legacyPaymentIsThisMonth(sub) ? Math.max(0, Number(sub.amountPaid || 0)) : 0;\n    const paid = Math.min(due, rawPaid);\n    const remaining = Math.max(0, due - paid);\n    return { sub, isFree, due, paid, remaining };\n  }) : [];\n\n  const paidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining === 0)\n    .map(row => row.sub);\n  const unpaidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining > 0)\n    .map(row => row.sub);\n  const totalCollectedRevenue = currentMonthRows.reduce((sum, row) => sum + row.paid, 0);\n  const totalUnpaidDebt = currentMonthRows.reduce((sum, row) => sum + row.remaining, 0);\n  const currentMonthTotal = currentMonthRows.reduce((sum, row) => sum + row.due, 0);\n\n`;

  source = source.slice(0, start) + block + source.slice(end);
  if (!source.includes('DASHBOARD_MONTH_ACCOUNTING_SINGLE_SOURCE_V2')) {
    throw new Error('Dashboard consistency v2: accounting marker missing');
  }
  write(path, source);
}

// Final mobile cashbox pass. Use the same ledger semantics as WalletView:
// payment adds, cancellation subtracts, and records before the last reset are ignored.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let source = read(path);
  if (!source.includes('auditLogs') || !source.includes('walletResetTimestamp')) {
    throw new Error('Dashboard consistency v2: MobileLayout wallet data missing');
  }

  const helper = `  // DASHBOARD_CASHBOX_SINGLE_SOURCE_V2\n  const dashboardWalletResetTime = walletResetTimestamp ? new Date(walletResetTimestamp).getTime() : 0;\n  const dashboardCashboxAmount = auditLogs\n    .filter(log => {\n      if (log.category !== 'payment' && log.category !== 'cancellation') return false;\n      if (dashboardWalletResetTime > 0 && log.timestamp) {\n        const logTime = new Date(log.timestamp).getTime();\n        if (Number.isFinite(logTime) && logTime < dashboardWalletResetTime) return false;\n      }\n      return true;\n    })\n    .reduce((sum, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? sum - amount : sum + amount;\n    }, 0);\n\n`;

  const oldHelperStart = source.indexOf('  // DASHBOARD_CASHBOX_SINGLE_SOURCE_V1');
  if (oldHelperStart >= 0) {
    const returnIndex = source.indexOf('  return (', oldHelperStart);
    if (returnIndex < 0) throw new Error('Dashboard consistency v2: old helper end missing');
    source = source.slice(0, oldHelperStart) + helper + source.slice(returnIndex);
  } else if (!source.includes('DASHBOARD_CASHBOX_SINGLE_SOURCE_V2')) {
    const returnIndex = source.indexOf('  return (');
    if (returnIndex < 0) throw new Error('Dashboard consistency v2: MobileLayout return missing');
    source = source.slice(0, returnIndex) + helper + source.slice(returnIndex);
  }

  const attrStart = source.indexOf('            cashboxAmount={');
  if (attrStart >= 0) {
    const attrEnd = source.indexOf('\n', attrStart);
    if (attrEnd < 0) throw new Error('Dashboard consistency v2: cashbox prop line end missing');
    source = source.slice(0, attrStart) + '            cashboxAmount={dashboardCashboxAmount}' + source.slice(attrEnd);
  } else {
    const nav = '            onNavigateToTab={onTabChange}\n';
    if (!source.includes(nav)) throw new Error('Dashboard consistency v2: dashboard navigation prop missing');
    source = source.replace(nav, nav + '            cashboxAmount={dashboardCashboxAmount}\n');
  }

  if (!source.includes('cashboxAmount={dashboardCashboxAmount}')) {
    throw new Error('Dashboard consistency v2: cashbox prop still divergent');
  }
  write(path, source);
}

// Earlier cabinet/wallet finalizer owns WalletView. Verify that its formula matches
// the dashboard formula instead of rewriting the CRLF-formatted file again here.
{
  const wallet = read('src/components/WalletView.tsx').replace(/\r\n/g, '\n');
  if (!wallet.includes("log.category === 'payment' || log.category === 'cancellation'") ||
      !wallet.includes("log.category === 'cancellation' ?")) {
    throw new Error('Dashboard consistency v2: WalletView is not payment-minus-cancellation based');
  }
}

console.log('Dashboard unpaid count and cashbox consistency v2 applied.');

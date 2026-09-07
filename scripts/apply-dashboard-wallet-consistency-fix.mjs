import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// 1) Mobile dashboard: derive paid count, unpaid count, collected amount,
// unpaid amount, and current-month total from the SAME per-subscriber snapshot.
// This prevents contradictions such as an unpaid amount > 0 while unpaid count = 0.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let source = read(path);

  if (!source.includes("getMonthId")) {
    source = source.replace(
      "import { getInvoiceRemaining } from '../../utils/monthlyAccounting';",
      "import { getInvoiceRemaining, getMonthId } from '../../utils/monthlyAccounting';"
    );
  }

  const currentAccountStart = source.indexOf('  const currentAccount = (sub: Subscriber) =>');
  const existingBillingGuard = currentAccountStart >= 0
    ? source.lastIndexOf('  const billingCycleActive = pricingTiers.some', currentAccountStart)
    : -1;
  const blockStart = existingBillingGuard >= 0 ? existingBillingGuard : currentAccountStart;
  const blockEnd = source.indexOf('  const circleLength =', currentAccountStart);

  if (currentAccountStart < 0 || blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
    throw new Error('Dashboard consistency fix: accounting block not found');
  }

  const replacement = `  // DASHBOARD_MONTH_ACCOUNTING_SINGLE_SOURCE_V1\n  // Every dashboard billing widget is derived from this one current-month snapshot.\n  const billingCycleActive = pricingTiers.some(t =>\n    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)\n  );\n\n  const currentAccount = (sub: Subscriber) => {\n    if (!billingCycleActive) return undefined;\n    return (sub.invoicesHistory || [])\n      .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')\n      .sort((a, b) => {\n        const aTime = a.paymentDate || a.issueDate || '';\n        const bTime = b.paymentDate || b.issueDate || '';\n        if (aTime !== bTime) return bTime.localeCompare(aTime);\n        const aPaid = Number(a.paidAmount || 0);\n        const bPaid = Number(b.paidAmount || 0);\n        if (aPaid !== bPaid) return bPaid - aPaid;\n        return String(b.id || '').localeCompare(String(a.id || ''));\n      })[0];\n  };\n\n  const legacyPaymentIsThisMonth = (sub: Subscriber) => {\n    if (!billingCycleActive || !sub.lastPaymentDate) return false;\n    const paymentDate = new Date(sub.lastPaymentDate);\n    return !Number.isNaN(paymentDate.getTime()) && getMonthId(paymentDate) === activeMonthId;\n  };\n\n  const currentMonthRows = billingCycleActive\n    ? subscribers.map(sub => {\n        const invoice = currentAccount(sub);\n        const isFree = invoice?.status === 'free' || sub.tier === 'free' || Boolean(sub.isExempted);\n        const due = isFree\n          ? 0\n          : Math.max(0, invoice\n              ? Number(invoice.totalAmount || 0)\n              : Number(calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));\n        const rawPaid = invoice\n          ? Math.max(0, Number(invoice.paidAmount || 0))\n          : legacyPaymentIsThisMonth(sub)\n            ? Math.max(0, Number(sub.amountPaid || 0))\n            : 0;\n        const paid = Math.min(due, rawPaid);\n        const remaining = Math.max(0, due - paid);\n        return { sub, isFree, due, paid, remaining };\n      })\n    : [];\n\n  const paidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining === 0)\n    .map(row => row.sub);\n\n  const unpaidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining > 0)\n    .map(row => row.sub);\n\n  const totalCollectedRevenue = currentMonthRows\n    .reduce((sum, row) => sum + row.paid, 0);\n\n  const totalUnpaidDebt = currentMonthRows\n    .reduce((sum, row) => sum + row.remaining, 0);\n\n  // Current-month charge only; carried historical debt is not added here.\n  const currentMonthTotal = currentMonthRows\n    .reduce((sum, row) => sum + row.due, 0);\n\n`;

  source = source.slice(0, blockStart) + replacement + source.slice(blockEnd);

  if (!source.includes('DASHBOARD_MONTH_ACCOUNTING_SINGLE_SOURCE_V1')) {
    throw new Error('Dashboard consistency fix: marker missing after rewrite');
  }
  if (!source.includes('.filter(row => !row.isFree && row.due > 0 && row.remaining > 0)')) {
    throw new Error('Dashboard consistency fix: unpaid count is not remaining-based');
  }

  write(path, source);
}

// 2) Mobile dashboard cashbox and WalletView must use exactly the same ledger rule:
// payments add money, cancellations subtract money, and anything before the last reset is ignored.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let source = read(path);

  if (!source.includes('auditLogs') || !source.includes('walletResetTimestamp')) {
    throw new Error('Dashboard wallet consistency fix: MobileLayout wallet props are missing');
  }

  const helper = `  // DASHBOARD_CASHBOX_SINGLE_SOURCE_V1\n  const dashboardWalletResetTime = walletResetTimestamp ? new Date(walletResetTimestamp).getTime() : 0;\n  const dashboardCashboxAmount = auditLogs\n    .filter(log => {\n      if (log.category !== 'payment' && log.category !== 'cancellation') return false;\n      if (dashboardWalletResetTime > 0 && log.timestamp) {\n        const logTime = new Date(log.timestamp).getTime();\n        if (Number.isFinite(logTime) && logTime < dashboardWalletResetTime) return false;\n      }\n      return true;\n    })\n    .reduce((sum, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? sum - amount : sum + amount;\n    }, 0);\n\n`;

  if (!source.includes('DASHBOARD_CASHBOX_SINGLE_SOURCE_V1')) {
    const returnIndex = source.indexOf('  return (');
    if (returnIndex < 0) throw new Error('Dashboard wallet consistency fix: MobileLayout return not found');
    source = source.slice(0, returnIndex) + helper + source.slice(returnIndex);
  }

  const cashboxAttrStart = source.indexOf('            cashboxAmount={');
  if (cashboxAttrStart >= 0) {
    const cashboxAttrEnd = source.indexOf('\n', cashboxAttrStart);
    if (cashboxAttrEnd < 0) throw new Error('Dashboard wallet consistency fix: cashbox attribute end not found');
    source = source.slice(0, cashboxAttrStart)
      + '            cashboxAmount={dashboardCashboxAmount}'
      + source.slice(cashboxAttrEnd);
  } else {
    const navLine = '            onNavigateToTab={onTabChange}\n';
    if (!source.includes(navLine)) throw new Error('Dashboard wallet consistency fix: MobileDashboard nav prop not found');
    source = source.replace(navLine, navLine + '            cashboxAmount={dashboardCashboxAmount}\n');
  }

  if (!source.includes('cashboxAmount={dashboardCashboxAmount}')) {
    throw new Error('Dashboard wallet consistency fix: dashboard cashbox prop not authoritative');
  }

  write(path, source);
}

// 3) Reassert the wallet page balance formula as the same payment-minus-cancellation ledger.
{
  const path = 'src/components/WalletView.tsx';
  let source = read(path);
  const start = source.indexOf('  const totalCollected =');
  const end = start >= 0 ? source.indexOf('\n\n  return (', start) : -1;
  if (start < 0 || end < 0) throw new Error('Dashboard wallet consistency fix: WalletView total block not found');

  const replacement = `  const totalCollected = financialLogs\n    .filter(log => log.category === 'payment' || log.category === 'cancellation')\n    .reduce((sum, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? sum - amount : sum + amount;\n    }, 0);`;

  source = source.slice(0, start) + replacement + source.slice(end);
  write(path, source);
}

console.log('Dashboard unpaid count and cashbox now use authoritative current-month/ledger calculations.');

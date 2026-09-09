import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// Final mobile dashboard accounting source-of-truth for legacy builds. On the second
// lint->build pass, the newer authoritative finance finalizer may already own this block;
// preserve that newer source instead of looking for/overwriting legacy currentAccount.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let source = read(path);
  const authoritativeDashboard =
    source.includes('AUTHORITATIVE_FINANCE_V2') &&
    source.includes('summarizeSubscribers(subscribers, pricingTiers, activeMonthId)') &&
    source.includes('const billingCycleActive = pricingTiers.some');

  if (!authoritativeDashboard) {
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
      throw new Error('Dashboard consistency v3: accounting bounds not found');
    }

    const block = `  // DASHBOARD_MONTH_ACCOUNTING_SINGLE_SOURCE_V3\n  const billingCycleActive = pricingTiers.some(t =>\n    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)\n  );\n\n  const currentAccount = (sub: Subscriber) => {\n    if (!billingCycleActive) return undefined;\n    return (sub.invoicesHistory || [])\n      .filter(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled')\n      .sort((a, b) => {\n        const aTime = a.paymentDate || a.issueDate || '';\n        const bTime = b.paymentDate || b.issueDate || '';\n        if (aTime !== bTime) return bTime.localeCompare(aTime);\n        const aPaid = Number(a.paidAmount || 0);\n        const bPaid = Number(b.paidAmount || 0);\n        if (aPaid !== bPaid) return bPaid - aPaid;\n        return String(b.id || '').localeCompare(String(a.id || ''));\n      })[0];\n  };\n\n  const legacyPaymentIsThisMonth = (sub: Subscriber) => {\n    if (!billingCycleActive || !sub.lastPaymentDate) return false;\n    const d = new Date(sub.lastPaymentDate);\n    return !Number.isNaN(d.getTime()) && getMonthId(d) === activeMonthId;\n  };\n\n  const currentMonthRows = billingCycleActive ? subscribers.map(sub => {\n    const invoice = currentAccount(sub);\n    const isFree = invoice?.status === 'free' || sub.tier === 'free' || Boolean(sub.isExempted);\n    const due = isFree ? 0 : Math.max(0, invoice\n      ? Number(invoice.totalAmount || 0)\n      : Number(calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));\n    const rawPaid = invoice\n      ? Math.max(0, Number(invoice.paidAmount || 0))\n      : legacyPaymentIsThisMonth(sub) ? Math.max(0, Number(sub.amountPaid || 0)) : 0;\n    const paid = Math.min(due, rawPaid);\n    const remaining = Math.max(0, due - paid);\n    return { sub, isFree, due, paid, remaining };\n  }) : [];\n\n  const paidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining === 0)\n    .map(row => row.sub);\n  const unpaidSubs = currentMonthRows\n    .filter(row => !row.isFree && row.due > 0 && row.remaining > 0)\n    .map(row => row.sub);\n  const totalCollectedRevenue = currentMonthRows.reduce((sum, row) => sum + row.paid, 0);\n  const totalUnpaidDebt = currentMonthRows.reduce((sum, row) => sum + row.remaining, 0);\n  const currentMonthTotal = currentMonthRows.reduce((sum, row) => sum + row.due, 0);\n\n`;

    source = source.slice(0, start) + block + source.slice(end);
  } else {
    console.log('skip: dashboard V3 legacy accounting block; authoritative finance already active');
  }
  write(path, source);
}

// Make the mobile dashboard cashbox use the exact unfiltered WalletView algorithm.
// This includes resolving old cancellation rows whose amount is empty by matching
// them to the latest unmatched payment for the same subscriber.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let source = read(path);
  if (!source.includes('auditLogs') || !source.includes('walletResetTimestamp')) {
    throw new Error('Dashboard consistency v3: MobileLayout wallet data missing');
  }

  const helper = `  // DASHBOARD_CASHBOX_WALLETVIEW_PARITY_V3\n  const dashboardWalletResetTime = walletResetTimestamp ? new Date(walletResetTimestamp).getTime() : 0;\n  const dashboardFinancialLogs = auditLogs.filter(log => {\n    if (log.category !== 'payment' && log.category !== 'cancellation') return false;\n    if (dashboardWalletResetTime > 0 && log.timestamp) {\n      const logTime = new Date(log.timestamp).getTime();\n      if (Number.isFinite(logTime) && logTime < dashboardWalletResetTime) return false;\n    }\n    return true;\n  });\n\n  const dashboardCashboxAmount = (() => {\n    const ordered = [...dashboardFinancialLogs].sort((a, b) =>\n      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()\n    );\n    const unmatchedPayments = new Map<string, number[]>();\n    let payments = 0;\n    let cancellations = 0;\n\n    ordered.forEach(log => {\n      const entityKey = String(log.entityId || 'unknown');\n      if (log.category === 'payment') {\n        const amount = Math.max(0, Number(log.amount) || 0);\n        payments += amount;\n        if (amount > 0) {\n          const stack = unmatchedPayments.get(entityKey) || [];\n          stack.push(amount);\n          unmatchedPayments.set(entityKey, stack);\n        }\n        return;\n      }\n\n      let amount = Math.max(0, Number(log.amount) || 0);\n      const stack = unmatchedPayments.get(entityKey) || [];\n      if (!amount && stack.length) amount = stack.pop() || 0;\n      else if (amount && stack.length) stack.pop();\n      unmatchedPayments.set(entityKey, stack);\n      cancellations += amount;\n    });\n\n    return Math.max(0, payments - cancellations);\n  })();\n\n`;

  const knownMarkers = [
    '  // DASHBOARD_CASHBOX_SINGLE_SOURCE_V1',
    '  // DASHBOARD_CASHBOX_SINGLE_SOURCE_V2',
    '  // DASHBOARD_CASHBOX_WALLETVIEW_PARITY_V3',
  ];
  let oldStart = -1;
  for (const marker of knownMarkers) {
    const idx = source.indexOf(marker);
    if (idx >= 0) { oldStart = idx; break; }
  }

  if (oldStart >= 0) {
    const returnIndex = source.indexOf('  return (', oldStart);
    if (returnIndex < 0) throw new Error('Dashboard consistency v3: prior helper end missing');
    source = source.slice(0, oldStart) + helper + source.slice(returnIndex);
  } else {
    const returnIndex = source.indexOf('  return (');
    if (returnIndex < 0) throw new Error('Dashboard consistency v3: MobileLayout return missing');
    source = source.slice(0, returnIndex) + helper + source.slice(returnIndex);
  }

  const attrStart = source.indexOf('            cashboxAmount={');
  if (attrStart >= 0) {
    const attrEnd = source.indexOf('\n', attrStart);
    if (attrEnd < 0) throw new Error('Dashboard consistency v3: cashbox prop line end missing');
    source = source.slice(0, attrStart) + '            cashboxAmount={dashboardCashboxAmount}' + source.slice(attrEnd);
  } else {
    const nav = '            onNavigateToTab={onTabChange}\n';
    if (!source.includes(nav)) throw new Error('Dashboard consistency v3: dashboard navigation prop missing');
    source = source.replace(nav, nav + '            cashboxAmount={dashboardCashboxAmount}\n');
  }

  write(path, source);
}

// Confirm either the legacy resolved-cancellation wallet implementation or the newer
// authoritative reconciled cashbox survived the remaining release patches.
{
  const wallet = read('src/components/WalletView.tsx');
  const legacyWallet = wallet.includes('walletResolvedAmounts') && wallet.includes('unmatchedPayments');
  const authoritativeWallet = wallet.includes('AUTHORITATIVE_WALLET_V2') && wallet.includes('reconciledCashbox(');
  if (!legacyWallet && !authoritativeWallet) {
    throw new Error('Dashboard consistency v3: authoritative WalletView calculation missing');
  }
}

console.log('Dashboard unpaid count fixed and cashbox matched exactly to WalletView.');

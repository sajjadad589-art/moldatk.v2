import fs from 'node:fs';

const path = 'src/components/mobile/MobileDashboard.tsx';
if (!fs.existsSync(path)) throw new Error('Dashboard outstanding fix: MobileDashboard.tsx missing');

let source = fs.readFileSync(path, 'utf8');

// The paid/unpaid cards represent the subscriber's REAL outstanding state.
// Monthly invoice calculations remain responsible only for current-month revenue/total.
// This keeps an old/carried balance visible as "غير مسدد" instead of incorrectly showing 0.
const paidStart = source.indexOf('  const paidSubs =');
const collectedStart = paidStart >= 0 ? source.indexOf('  const totalCollectedRevenue =', paidStart) : -1;
if (paidStart < 0 || collectedStart < 0 || collectedStart <= paidStart) {
  throw new Error('Dashboard outstanding fix: paid/unpaid block not found');
}

const statusBlock = `  // DASHBOARD_OUTSTANDING_STATUS_SINGLE_SOURCE_V1\n  const hasOutstandingBalance = (sub: Subscriber) => {\n    if (sub.tier === 'free' || sub.isExempted || sub.paymentStatus === 'free') return false;\n    return sub.paymentStatus === 'unpaid'\n      || sub.paymentStatus === 'partial'\n      || Math.max(0, Number(sub.amountDue || 0)) > 0;\n  };\n\n  const paidSubs = subscribers.filter(sub => {\n    if (sub.tier === 'free' || sub.isExempted || sub.paymentStatus === 'free') return false;\n    return sub.paymentStatus === 'paid' && !hasOutstandingBalance(sub);\n  });\n\n  const unpaidSubs = subscribers.filter(hasOutstandingBalance);\n\n`;

source = source.slice(0, paidStart) + statusBlock + source.slice(collectedStart);

// The red amount must match the same unpaid population. amountDue is the documented
// total outstanding balance across monthly invoices, so it includes carried debt correctly.
const debtStart = source.indexOf('  const totalUnpaidDebt =');
const debtEnd = debtStart >= 0 ? source.indexOf('\n\n  //', debtStart) : -1;
if (debtStart < 0 || debtEnd < 0 || debtEnd <= debtStart) {
  throw new Error('Dashboard outstanding fix: totalUnpaidDebt block not found');
}

const debtBlock = `  const totalUnpaidDebt = unpaidSubs.reduce(\n    (sum, sub) => sum + Math.max(0, Number(sub.amountDue || 0)),\n    0\n  );`;

source = source.slice(0, debtStart) + debtBlock + source.slice(debtEnd);

if (!source.includes('DASHBOARD_OUTSTANDING_STATUS_SINGLE_SOURCE_V1')) {
  throw new Error('Dashboard outstanding fix: marker missing');
}
if (!source.includes('const unpaidSubs = subscribers.filter(hasOutstandingBalance);')) {
  throw new Error('Dashboard outstanding fix: unpaid status source missing');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Dashboard unpaid count/amount now follow real outstanding subscriber balances.');

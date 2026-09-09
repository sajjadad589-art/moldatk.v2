import fs from 'node:fs';

const path = 'src/components/POSQuickView.tsx';
if (!fs.existsSync(path)) throw new Error('Collector dashboard accounting: POSQuickView.tsx missing');

let source = fs.readFileSync(path, 'utf8');

if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1')) {
  const start = source.indexOf('  const totalCollected =');
  const activeTierStart = source.indexOf('  const activeTierPrice =', start);
  const activeTierEnd = activeTierStart >= 0 ? source.indexOf('\n', activeTierStart) : -1;

  if (start < 0 || activeTierStart < 0 || activeTierEnd < 0) {
    throw new Error('Collector dashboard accounting: legacy dashboard accounting block not found');
  }
  if (!source.includes('  const collectibleSubscribers =')) {
    throw new Error('Collector dashboard accounting: collectible subscriber scope missing');
  }
  if (!source.includes('getInvoiceRemaining')) {
    throw new Error('Collector dashboard accounting: monthly ledger helper missing');
  }

  const accountingBlock = `  // COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1
  // Every dashboard number is calculated from the same billable subscriber scope and
  // the same canonical monthly-ledger rows. Duplicate legacy receipt snapshots for the
  // same month are collapsed to the newest accounting state before totals are derived.
  const getCanonicalCollectorInvoices = (sub: Subscriber): SubscriberInvoice[] => {
    const byMonth = new Map<string, SubscriberInvoice>();

    for (const inv of sub.invoicesHistory || []) {
      if (inv.status === 'cancelled' || inv.status === 'free') continue;
      const monthKey = String(inv.monthId || inv.id || 'legacy');
      const existing = byMonth.get(monthKey);
      if (!existing) {
        byMonth.set(monthKey, inv);
        continue;
      }

      const existingTime = existing.paymentDate || existing.issueDate || '';
      const incomingTime = inv.paymentDate || inv.issueDate || '';
      const existingPaid = Math.max(0, Number(existing.paidAmount || 0));
      const incomingPaid = Math.max(0, Number(inv.paidAmount || 0));
      const existingRemaining = getInvoiceRemaining(existing);
      const incomingRemaining = getInvoiceRemaining(inv);

      const incomingIsNewer = incomingTime > existingTime
        || (incomingTime === existingTime && incomingPaid > existingPaid)
        || (incomingTime === existingTime && incomingPaid === existingPaid && incomingRemaining < existingRemaining)
        || (incomingTime === existingTime && incomingPaid === existingPaid && incomingRemaining === existingRemaining
          && String(inv.id || '').localeCompare(String(existing.id || '')) > 0);

      if (incomingIsNewer) byMonth.set(monthKey, inv);
    }

    return Array.from(byMonth.values());
  };

  const getCollectorAccountingRow = (sub: Subscriber) => {
    const invoices = getCanonicalCollectorInvoices(sub);

    if (invoices.length > 0) {
      const billed = invoices.reduce((sum, inv) => sum + Math.max(0, Number(inv.totalAmount || 0)), 0);
      const collected = invoices.reduce((sum, inv) => {
        const total = Math.max(0, Number(inv.totalAmount || 0));
        const paid = Math.max(0, Number(inv.paidAmount || 0));
        return sum + Math.min(total, paid);
      }, 0);
      const outstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      return { sub, billed, collected, outstanding };
    }

    // Legacy fallback only when no monthly ledger exists yet.
    const outstanding = Math.max(0, Number(sub.amountDue || 0));
    const collected = Math.max(0, Number(sub.amountPaid || 0));
    const calculated = Math.max(0, Number(calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));
    const billed = Math.max(calculated, outstanding + collected);
    return { sub, billed, collected, outstanding };
  };

  const collectorAccountingRows = collectibleSubscribers.map(getCollectorAccountingRow);
  const collectorAccountingById = new Map(collectorAccountingRows.map(row => [row.sub.id, row]));

  // Dashboard cards always use one scope. Cabinet selection narrows every card together;
  // text search only narrows the detailed list below and never changes headline totals.
  const dashboardAccountingRows = selectedLineFilter === 'all'
    ? collectorAccountingRows
    : collectorAccountingRows.filter(row => row.sub.lineId === selectedLineFilter);

  const totalCollected = dashboardAccountingRows.reduce((sum, row) => sum + row.collected, 0);
  const totalUnpaid = dashboardAccountingRows.reduce((sum, row) => sum + row.outstanding, 0);
  const dashboardPaidSubscribers = dashboardAccountingRows.filter(row => row.billed > 0 && row.outstanding <= 0);

  const paidSubscribersList = filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && row.billed > 0 && row.outstanding <= 0);
  });
  const unpaidSubscribersList = filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && row.outstanding > 0);
  });

  const activeTier = pricingTiers.find(t => t.type === 'normal')
    || pricingTiers.find(t => t.type !== 'free');
  const activeTierPrice = Math.max(0, Number(activeTier?.pricePerAmpere || 0));`;

  source = source.slice(0, start) + accountingBlock + source.slice(activeTierEnd);

  // The paid headline must use the exact same cabinet scope as the money cards.
  source = source.replace(
    /\{paidSubscribersList\.length\}\s*مشترك/,
    '{dashboardPaidSubscribers.length} مشترك'
  );

  // Detailed debtor rows must show the exact outstanding value used by the red card.
  source = source.replace(
    `              const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);\n              const dueAmount = sub.amountDue > 0 ? sub.amountDue : calc.total;`,
    `              const accountingRow = collectorAccountingById.get(sub.id);\n              const dueAmount = accountingRow\n                ? accountingRow.outstanding\n                : Math.max(0, Number(sub.amountDue || calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));`
  );
}

if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1')) {
  throw new Error('Collector dashboard accounting: source-of-truth marker missing');
}
if (!source.includes('{dashboardPaidSubscribers.length} مشترك')) {
  throw new Error('Collector dashboard accounting: paid count is not tied to dashboard scope');
}
if (!source.includes('const totalCollected = dashboardAccountingRows.reduce')) {
  throw new Error('Collector dashboard accounting: collected total is not authoritative');
}
if (!source.includes('const totalUnpaid = dashboardAccountingRows.reduce')) {
  throw new Error('Collector dashboard accounting: unpaid total is not authoritative');
}
if (!source.includes('const dueAmount = accountingRow')) {
  throw new Error('Collector dashboard accounting: subscriber due value is not aligned');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Collector dashboard accounting matched: collected, unpaid, paid count and row balances now come from one canonical ledger source.');

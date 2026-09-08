import fs from 'node:fs';

const must = (condition, message) => { if (!condition) throw new Error(message); };
const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// -----------------------------------------------------------------------------
// Collector/POS final payment path.
// The monthly-ledger finalizer owns handleConfirmPayment by the time this file runs.
// Therefore patch the actual final handler rather than the old legacy handler.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/POSQuickView.tsx';
  must(fs.existsSync(path), 'Collector payment integrity: POSQuickView.tsx missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2')) {
    const paymentLine = `    const paymentAmount = Math.max(0, Number(data.amountPaid || 0));\n    if (paymentAmount <= 0) return;`;
    must(src.includes(paymentLine), 'Collector payment integrity: final monthly payment line missing');
    src = src.replace(paymentLine, `    // COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2\n    // "تسديد نقدي/كامل" always clears the whole ledger, independent of a stale UI\n    // amount. Partial payments remain capped at the real outstanding balance.\n    const outstandingBefore = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n    const requestedPayment = Math.max(0, Number(data.amountPaid || 0));\n    const paymentAmount = data.method === 'full'\n      ? outstandingBefore\n      : Math.min(outstandingBefore, requestedPayment);\n    if (paymentAmount <= 0) return;`);
  }

  if (!src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2')) {
    const accessibleAnchor = '  const filteredSubs = accessibleSubscribers.filter(sub => {';
    const regularAnchor = '  const filteredSubs = subscribers.filter(sub => {';
    const filterBlock = sourceName => `  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2\n  // Free/exempt subscribers require no collection: hide them from the collector\n  // cards, search results, paid/unpaid lists, counters and collection totals.\n  const collectibleSubscribers = ${sourceName}.filter(sub =>\n    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'\n  );\n\n  const filteredSubs = collectibleSubscribers.filter(sub => {`;

    if (src.includes(accessibleAnchor)) {
      src = src.replace(accessibleAnchor, filterBlock('accessibleSubscribers'));
      src = src.replace(/accessibleSubscribers\.reduce\(/g, 'collectibleSubscribers.reduce(');
    } else {
      must(src.includes(regularAnchor), 'Collector payment integrity: collector list filter anchor missing');
      src = src.replace(regularAnchor, filterBlock('subscribers'));
      src = src.replace(/subscribers\.reduce\(/g, 'collectibleSubscribers.reduce(');
    }
  }

  must(src.includes('COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2'), 'Collector payment integrity: full-payment guard missing');
  must(src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2'), 'Collector payment integrity: free-subscriber filter missing');
  must(src.includes("paymentStatus: allocation.totalDebtAfter === 0 ? 'paid'"), 'Collector payment integrity: final ledger status logic missing');
  must(src.includes('amountDue: allocation.totalDebtAfter'), 'Collector payment integrity: final outstanding persistence missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// Collector cloud sync safety.
// Root cause of screenshot 42501/403: the generic collector push re-submitted EVERY
// subscriber including owner-created free/exempt rows. The DB correctly blocks a
// collector from applying an exemption, so the whole push failed and the later pull
// restored stale unpaid data. Collector push must exclude free rows and must never
// delete rows that are merely absent from its assigned/local view.
// -----------------------------------------------------------------------------
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  must(fs.existsSync(path), 'Collector payment integrity: useGeneratorCloudSync.ts missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_SYNC_FREE_GUARD_V2')) {
    const readAnchor = `        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);`;
    must(src.includes(readAnchor), 'Collector payment integrity: cloud subscriber read anchor missing');
    src = src.replace(readAnchor, `        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);\n        // COLLECTOR_SYNC_FREE_GUARD_V2\n        const collectorPush = session?.role === 'collector';\n        const writableSubscribers = collectorPush\n          ? subscribers.filter(s => s.paymentStatus !== 'free' && s.isExempted !== true && s.tier !== 'free')\n          : subscribers;\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);`);

    const invoiceAnchor = `        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);`;
    must(src.includes(invoiceAnchor), 'Collector payment integrity: invoice collection anchor missing');
    src = src.replace(invoiceAnchor, `        const invoices = writableSubscribers.flatMap(s => s.invoicesHistory || []);`);

    const subscriberPush = `        if (subscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(subscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }\n        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));`;
    must(src.includes(subscriberPush), 'Collector payment integrity: subscriber push anchor missing');
    src = src.replace(subscriberPush, `        if (writableSubscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }\n        // Collector views are partial/assigned views; only admin may delete-by-absence.\n        if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));\n        }`);

    const invoiceDelete = `        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));`;
    must(src.includes(invoiceDelete), 'Collector payment integrity: invoice delete anchor missing');
    src = src.replace(invoiceDelete, `        if (!collectorPush) {\n          await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));\n        }`);
  }

  must(src.includes('COLLECTOR_SYNC_FREE_GUARD_V2'), 'Collector payment integrity: collector sync guard missing');
  must(src.includes('writableSubscribers'), 'Collector payment integrity: writable subscriber scope missing');
  must(src.includes("if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers'"), 'Collector payment integrity: subscriber delete guard missing');
  must(src.includes("if (!collectorPush) {\n          await replaceMissingRows('generator_invoices'"), 'Collector payment integrity: invoice delete guard missing');
  write(path, src);
}

console.log('Collector QA finalizer v2: full cash clears exact debt, partials persist, free subscribers are hidden, and collector sync no longer triggers free-exemption 403.');

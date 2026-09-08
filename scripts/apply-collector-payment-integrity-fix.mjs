import fs from 'node:fs';

const must = (condition, message) => { if (!condition) throw new Error(message); };
const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// -----------------------------------------------------------------------------
// Collector/POS payment integrity.
// - cash/full payment must end with zero remaining balance
// - a second payment after a partial payment must accumulate the paid amount
// - free/exempt subscribers are not collection targets and must stay out of POS
// -----------------------------------------------------------------------------
{
  const path = 'src/components/POSQuickView.tsx';
  must(fs.existsSync(path), 'Collector payment integrity: POSQuickView.tsx missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_PAYMENT_REMAINDER_FIX_V1')) {
    const statusAnchor = `    const status: Subscriber['paymentStatus'] = data.method === 'full'\n      ? 'paid'\n      : data.method === 'partial'\n      ? 'partial'\n      : 'free';\n\n    const now = new Date();`;

    const statusReplacement = `    const status: Subscriber['paymentStatus'] = data.method === 'full'\n      ? 'paid'\n      : data.method === 'partial'\n      ? 'partial'\n      : 'free';\n\n    // COLLECTOR_PAYMENT_REMAINDER_FIX_V1\n    // The collector pays the CURRENT outstanding balance. Preserve earlier payments\n    // and persist the true remaining balance instead of restoring the original due.\n    const paymentAmount = Math.max(0, Math.min(Number(data.amountPaid || 0), totalAmount));\n    const requestedRemaining = Number(data.remainingAmount);\n    const remainingAmount = status === 'free'\n      ? 0\n      : Math.max(0, Math.min(totalAmount, Number.isFinite(requestedRemaining)\n          ? requestedRemaining\n          : totalAmount - paymentAmount));\n    const previousPaid = Math.max(0, Number(sub.amountPaid || 0));\n    const cumulativePaid = status === 'free' ? previousPaid : previousPaid + paymentAmount;\n    const effectiveStatus: Subscriber['paymentStatus'] = status === 'free'\n      ? 'free'\n      : remainingAmount <= 0\n        ? 'paid'\n        : paymentAmount > 0\n          ? 'partial'\n          : 'unpaid';\n\n    const now = new Date();`;

    must(src.includes(statusAnchor), 'Collector payment integrity: payment status anchor missing');
    src = src.replace(statusAnchor, statusReplacement);

    const invoiceAmounts = `      paidAmount: data.amountPaid,\n      remainingAmount: data.remainingAmount,\n      status,`;
    must(src.includes(invoiceAmounts), 'Collector payment integrity: invoice amount block missing');
    src = src.replace(invoiceAmounts, `      paidAmount: paymentAmount,\n      remainingAmount,\n      status: effectiveStatus,`);

    const subscriberAmounts = `      paymentStatus: status,\n      amountDue: totalAmount,\n      amountPaid: data.amountPaid,\n      lastPaymentDate: now.toISOString(),\n      isExempted: status === 'free',\n      exemptReason: status === 'free' ? data.freeReason : sub.exemptReason,`;
    must(src.includes(subscriberAmounts), 'Collector payment integrity: subscriber amount block missing');
    src = src.replace(subscriberAmounts, `      paymentStatus: effectiveStatus,\n      amountDue: remainingAmount,\n      amountPaid: cumulativePaid,\n      lastPaymentDate: now.toISOString(),\n      isExempted: status === 'free',\n      exemptReason: status === 'free' ? data.freeReason : undefined,`);

    // Keep audit wording aligned with the actual resulting state.
    src = src.replace(
      `      title: status === 'paid' ? 'تسديد كامل' : status === 'partial' ? 'تسديد جزئي' : 'إعفاء مجاني',`,
      `      title: effectiveStatus === 'paid' ? 'تسديد كامل' : effectiveStatus === 'partial' ? 'تسديد جزئي' : effectiveStatus === 'free' ? 'إعفاء مجاني' : 'تسديد',`
    );
    src = src.replace(
      `      details: status === 'free'`,
      `      details: effectiveStatus === 'free'`
    );
    src = src.replace(
      `        : \`تم تسديد المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) بمبلغ \${data.amountPaid.toLocaleString('en-US')} \${generatorSpecs.currency || 'د.ع'}\``,
      `        : \`تم تسديد المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) بمبلغ \${paymentAmount.toLocaleString('en-US')} \${generatorSpecs.currency || 'د.ع'}\``
    );
    src = src.replace(`      amount: data.amountPaid,`, `      amount: paymentAmount,`);
  }

  if (!src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1')) {
    if (src.includes('  const filteredSubs = accessibleSubscribers.filter(sub => {')) {
      src = src.replace(
        '  const filteredSubs = accessibleSubscribers.filter(sub => {',
        `  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1\n  // Free/exempt subscribers do not require collection and are intentionally absent\n  // from the collector list, search results, counters and collection totals.\n  const collectibleSubscribers = accessibleSubscribers.filter(sub =>\n    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'\n  );\n\n  const filteredSubs = collectibleSubscribers.filter(sub => {`
      );
      src = src.replace(/accessibleSubscribers\.reduce\(/g, 'collectibleSubscribers.reduce(');
    } else {
      must(src.includes('  const filteredSubs = subscribers.filter(sub => {'), 'Collector payment integrity: subscriber filtering anchor missing');
      src = src.replace(
        '  const filteredSubs = subscribers.filter(sub => {',
        `  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1\n  const collectibleSubscribers = subscribers.filter(sub =>\n    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'\n  );\n\n  const filteredSubs = collectibleSubscribers.filter(sub => {`
      );
      src = src.replace(/subscribers\.reduce\(/g, 'collectibleSubscribers.reduce(');
    }
  }

  must(src.includes('COLLECTOR_PAYMENT_REMAINDER_FIX_V1'), 'Collector payment integrity: remainder marker missing');
  must(src.includes('amountDue: remainingAmount'), 'Collector payment integrity: remaining balance is not persisted');
  must(src.includes('amountPaid: cumulativePaid'), 'Collector payment integrity: cumulative paid amount is not persisted');
  must(src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1'), 'Collector payment integrity: free subscriber filter missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// Cloud sync safety for collector role.
// A collector is allowed to collect, but is NOT allowed to apply free exemptions.
// Generic full-array push previously re-sent existing free subscribers with
// is_exempted=true, causing Postgres 42501 collector_cannot_apply_free_exemption.
// Collector sync must therefore push collectible rows only and must never perform
// authoritative delete-by-absence operations.
// -----------------------------------------------------------------------------
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  must(fs.existsSync(path), 'Collector payment integrity: useGeneratorCloudSync.ts missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_SYNC_FREE_GUARD_V1')) {
    const readAnchor = `        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);`;
    const readReplacement = `        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);\n        // COLLECTOR_SYNC_FREE_GUARD_V1\n        // Existing free/exempt subscribers are valid owner data, but a collector must\n        // never re-submit those rows because the database correctly rejects exemption\n        // changes from collector accounts.\n        const collectorPush = session?.role === 'collector';\n        const writableSubscribers = collectorPush\n          ? subscribers.filter(s => s.paymentStatus !== 'free' && s.isExempted !== true && s.tier !== 'free')\n          : subscribers;\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);`;
    must(src.includes(readAnchor), 'Collector payment integrity: cloud subscriber read anchor missing');
    src = src.replace(readAnchor, readReplacement);

    src = src.replace(
      `        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);`,
      `        const invoices = writableSubscribers.flatMap(s => s.invoicesHistory || []);`
    );
    src = src.replace(
      `        if (subscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(subscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }\n        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));`,
      `        if (writableSubscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }\n        // Only the owner/admin may make the remote table authoritative by deletion.\n        if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));\n        }`
    );
    src = src.replace(
      `        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));`,
      `        if (!collectorPush) {\n          await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));\n        }`
    );
  }

  must(src.includes('COLLECTOR_SYNC_FREE_GUARD_V1'), 'Collector payment integrity: cloud free guard marker missing');
  must(src.includes('writableSubscribers'), 'Collector payment integrity: writable subscriber scope missing');
  must(src.includes("if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers'"), 'Collector payment integrity: collector delete guard missing');
  write(path, src);
}

console.log('Collector QA finalizer: fixed cash/partial balance persistence, cumulative payments, free-subscriber visibility, and 42501 free-exemption sync failures.');

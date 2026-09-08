import fs from 'node:fs';

const must = (condition, message) => { if (!condition) throw new Error(message); };
const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// Collector/POS payment integrity. This runs after the legacy build mutators, so
// matching is intentionally tolerant of whitespace/formatting changes.
{
  const path = 'src/components/POSQuickView.tsx';
  must(fs.existsSync(path), 'Collector payment integrity: POSQuickView.tsx missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_PAYMENT_REMAINDER_FIX_V1')) {
    const statusReplacement = `    const status: Subscriber['paymentStatus'] = data.method === 'full'\n      ? 'paid'\n      : data.method === 'partial'\n      ? 'partial'\n      : 'free';\n\n    // COLLECTOR_PAYMENT_REMAINDER_FIX_V1\n    // Payments are applied to the current outstanding balance. Previous payments are\n    // preserved, and a full cash settlement must persist a zero remaining balance.\n    const paymentAmount = Math.max(0, Math.min(Number(data.amountPaid || 0), totalAmount));\n    const requestedRemaining = Number(data.remainingAmount);\n    const remainingAmount = status === 'free'\n      ? 0\n      : Math.max(0, Math.min(totalAmount, Number.isFinite(requestedRemaining)\n          ? requestedRemaining\n          : totalAmount - paymentAmount));\n    const previousPaid = Math.max(0, Number(sub.amountPaid || 0));\n    const cumulativePaid = status === 'free' ? previousPaid : previousPaid + paymentAmount;\n    const effectiveStatus: Subscriber['paymentStatus'] = status === 'free'\n      ? 'free'\n      : remainingAmount <= 0\n        ? 'paid'\n        : paymentAmount > 0\n          ? 'partial'\n          : 'unpaid';\n\n    const now = new Date();`;

    const statusRegex = /    const status: Subscriber\['paymentStatus'\]\s*=\s*data\.method\s*===\s*'full'[\s\S]*?\n\s*const now = new Date\(\);/;
    must(statusRegex.test(src), 'Collector payment integrity: payment status anchor missing');
    src = src.replace(statusRegex, statusReplacement);

    const invoiceRegex = /paidAmount:\s*data\.amountPaid,\s*\n\s*remainingAmount:\s*data\.remainingAmount,\s*\n\s*status,/;
    must(invoiceRegex.test(src), 'Collector payment integrity: invoice amount block missing');
    src = src.replace(invoiceRegex, `paidAmount: paymentAmount,\n      remainingAmount,\n      status: effectiveStatus,`);

    const subscriberRegex = /paymentStatus:\s*status,\s*\n\s*amountDue:\s*totalAmount,\s*\n\s*amountPaid:\s*data\.amountPaid,\s*\n\s*lastPaymentDate:\s*now\.toISOString\(\),\s*\n\s*isExempted:\s*status\s*===\s*'free',\s*\n\s*exemptReason:\s*status\s*===\s*'free'\s*\?\s*data\.freeReason\s*:\s*sub\.exemptReason,/;
    must(subscriberRegex.test(src), 'Collector payment integrity: subscriber amount block missing');
    src = src.replace(subscriberRegex, `paymentStatus: effectiveStatus,\n      amountDue: remainingAmount,\n      amountPaid: cumulativePaid,\n      lastPaymentDate: now.toISOString(),\n      isExempted: status === 'free',\n      exemptReason: status === 'free' ? data.freeReason : undefined,`);

    src = src.replace(
      /title:\s*status === 'paid' \? 'تسديد كامل' : status === 'partial' \? 'تسديد جزئي' : 'إعفاء مجاني',/,
      `title: effectiveStatus === 'paid' ? 'تسديد كامل' : effectiveStatus === 'partial' ? 'تسديد جزئي' : effectiveStatus === 'free' ? 'إعفاء مجاني' : 'تسديد',`
    );
    src = src.replace(/details:\s*status === 'free'/, `details: effectiveStatus === 'free'`);
    src = src.replace(/amount:\s*data\.amountPaid,/, `amount: paymentAmount,`);
  }

  if (!src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1')) {
    if (/  const filteredSubs = accessibleSubscribers\.filter\(sub => \{/.test(src)) {
      src = src.replace(
        /  const filteredSubs = accessibleSubscribers\.filter\(sub => \{/,
        `  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V1\n  // Free/exempt subscribers need no collection and stay outside the collector UI.\n  const collectibleSubscribers = accessibleSubscribers.filter(sub =>\n    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'\n  );\n\n  const filteredSubs = collectibleSubscribers.filter(sub => {`
      );
      src = src.replace(/accessibleSubscribers\.reduce\(/g, 'collectibleSubscribers.reduce(');
    } else {
      must(/  const filteredSubs = subscribers\.filter\(sub => \{/.test(src), 'Collector payment integrity: subscriber filtering anchor missing');
      src = src.replace(
        /  const filteredSubs = subscribers\.filter\(sub => \{/,
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

// Cloud sync safety for collector role: collector accounts must never re-submit owner
// free/exemption records, and must never delete rows merely because they are absent
// from the collector's local/assigned view.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  must(fs.existsSync(path), 'Collector payment integrity: useGeneratorCloudSync.ts missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_SYNC_FREE_GUARD_V1')) {
    const readRegex = /(\s*const subscribers = readLocal<Subscriber\[]>\(localKeys\.subscribers, \[]\);)(\s*\n\s*const lines = readLocal<LineDistribution\[]>\(localKeys\.lines, \[]\);)/;
    must(readRegex.test(src), 'Collector payment integrity: cloud subscriber read anchor missing');
    src = src.replace(readRegex, `$1\n        // COLLECTOR_SYNC_FREE_GUARD_V1\n        // The DB rejects collector attempts to apply free exemptions (42501). Existing\n        // free owner records therefore remain pull-only for collector sessions.\n        const collectorPush = session?.role === 'collector';\n        const writableSubscribers = collectorPush\n          ? subscribers.filter(s => s.paymentStatus !== 'free' && s.isExempted !== true && s.tier !== 'free')\n          : subscribers;$2`);

    src = src.replace(
      /const invoices = subscribers\.flatMap\(s => s\.invoicesHistory \|\| \[]\);/,
      `const invoices = writableSubscribers.flatMap(s => s.invoicesHistory || []);`
    );

    const subscriberPushRegex = /if \(subscribers\.length\) \{\s*const \{ error \} = await supabase\.from\('generator_subscribers'\)\.upsert\(subscribers\.map\(s => subscriberToRow\(generatorId, s\)\), \{ onConflict: 'generator_id,id' \}\);\s*if \(error\) throw error;\s*\}\s*await replaceMissingRows\('generator_subscribers', generatorId, subscribers\.map\(s => s\.id\)\);/;
    must(subscriberPushRegex.test(src), 'Collector payment integrity: cloud subscriber push block missing');
    src = src.replace(subscriberPushRegex, `if (writableSubscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }\n        if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));\n        }`);

    src = src.replace(
      /await replaceMissingRows\('generator_invoices', generatorId, invoices\.map\(i => i\.id\)\);/,
      `if (!collectorPush) {\n          await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));\n        }`
    );
  }

  must(src.includes('COLLECTOR_SYNC_FREE_GUARD_V1'), 'Collector payment integrity: cloud free guard marker missing');
  must(src.includes('writableSubscribers'), 'Collector payment integrity: writable subscriber scope missing');
  must(src.includes("if (!collectorPush) {\n          await replaceMissingRows('generator_subscribers'"), 'Collector payment integrity: collector delete guard missing');
  write(path, src);
}

console.log('Collector QA finalizer: cash settles correctly, partials accumulate, free subscribers are hidden, and collector sync no longer submits exemption rows.');

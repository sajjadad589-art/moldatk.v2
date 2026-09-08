import fs from 'node:fs';

const must = (condition, message) => { if (!condition) throw new Error(message); };
const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// Collector/POS final payment path. The monthly-ledger finalizer owns this handler.
{
  const path = 'src/components/POSQuickView.tsx';
  must(fs.existsSync(path), 'Collector payment integrity: POSQuickView.tsx missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2')) {
    const paymentLine = `    const paymentAmount = Math.max(0, Number(data.amountPaid || 0));\n    if (paymentAmount <= 0) return;`;
    must(src.includes(paymentLine), 'Collector payment integrity: final monthly payment line missing');
    src = src.replace(paymentLine, `    // COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2\n    // A full/cash payment always settles the real ledger balance, not a stale UI value.\n    const outstandingBefore = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n    const requestedPayment = Math.max(0, Number(data.amountPaid || 0));\n    const paymentAmount = data.method === 'full'\n      ? outstandingBefore\n      : Math.min(outstandingBefore, requestedPayment);\n    if (paymentAmount <= 0) return;`);
  }

  if (!src.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2')) {
    const accessibleAnchor = '  const filteredSubs = accessibleSubscribers.filter(sub => {';
    const regularAnchor = '  const filteredSubs = subscribers.filter(sub => {';
    const filterBlock = sourceName => `  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2\n  // Free/exempt subscribers require no collection and never appear for collectors.\n  const collectibleSubscribers = ${sourceName}.filter(sub =>\n    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'\n  );\n\n  const filteredSubs = collectibleSubscribers.filter(sub => {`;

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

// Collector cloud sync safety.
// The resilient sync pass already removes delete-by-absence operations. Here we only
// restrict collector upserts to collectible subscribers, fixing the 42501/403 shown
// in the console when an existing owner-created free subscriber was re-submitted.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  must(fs.existsSync(path), 'Collector payment integrity: useGeneratorCloudSync.ts missing');
  let src = read(path);

  if (!src.includes('COLLECTOR_SYNC_FREE_GUARD_V2')) {
    const subscriberRead = /(\s*)const subscribers = readLocal<Subscriber\[]>\(localKeys\.subscribers, \[]\);/;
    must(subscriberRead.test(src), 'Collector payment integrity: cloud subscriber read missing');
    src = src.replace(subscriberRead, `$1const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);$1// COLLECTOR_SYNC_FREE_GUARD_V2$1const collectorPush = session?.role === 'collector';$1const writableSubscribers = collectorPush$1  ? subscribers.filter(s => s.paymentStatus !== 'free' && s.isExempted !== true && s.tier !== 'free')$1  : subscribers;`);

    const invoicesLine = /const invoices = subscribers\.flatMap\(s => s\.invoicesHistory \|\| \[]\);/;
    must(invoicesLine.test(src), 'Collector payment integrity: cloud invoice source missing');
    src = src.replace(invoicesLine, `const invoices = writableSubscribers.flatMap(s => s.invoicesHistory || []);`);

    const subsBlock = /if \(subscribers\.length\) \{\s*const \{ error \} = await supabase\.from\('generator_subscribers'\)\.upsert\(subscribers\.map\(s => subscriberToRow\(generatorId, s\)\), \{ onConflict: 'generator_id,id' \}\);\s*if \(error\) throw error;\s*\}/;
    must(subsBlock.test(src), 'Collector payment integrity: subscriber upsert block missing');
    src = src.replace(subsBlock, `if (writableSubscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }`);
  }

  must(src.includes('COLLECTOR_SYNC_FREE_GUARD_V2'), 'Collector payment integrity: collector sync guard missing');
  must(src.includes('writableSubscribers'), 'Collector payment integrity: writable subscriber scope missing');
  must(src.includes("upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s))"), 'Collector payment integrity: collector-safe upsert missing');
  // Resilient sync must already have removed authoritative deletes, especially for partial collector views.
  must(!src.includes("await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));"), 'Collector payment integrity: unsafe subscriber delete-by-absence remains');
  write(path, src);
}

console.log('Collector QA finalizer v2: full cash clears exact debt, partials persist, free subscribers are hidden, and collector sync no longer triggers free-exemption 403.');

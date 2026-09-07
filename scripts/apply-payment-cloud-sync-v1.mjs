import fs from 'node:fs';

const path = 'src/lib/useGeneratorCloudSync.ts';
const read = () => fs.readFileSync(path, 'utf8');
const write = content => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

let src = read();

// Some earlier release guards deliberately remove destructive reconciliation
// altogether. If an older form survives, keep it owner-only; if it is already
// absent, that is the safer state for collectors and needs no extra mutation.
const guardReconcile = (table, marker) => {
  if (src.includes(marker)) return;
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^(\\s*)await replaceMissingRows\\('${escaped}',[^\\n]+\\);`, 'm');
  const match = src.match(re);
  if (!match) return;
  const original = match[0].trimStart();
  const indent = match[1] || '';
  src = src.replace(re, `${indent}// ${marker}\n${indent}if (session?.role === 'generator_admin') {\n${indent}  ${original}\n${indent}}`);
};

guardReconcile('generator_subscribers', 'PAYMENT_COLLECTOR_NO_DESTRUCTIVE_RECONCILE');
guardReconcile('generator_invoices', 'PAYMENT_COLLECTOR_NO_INVOICE_RECONCILE');

// A realtime event fired by our own subscriber upsert must not pull an older
// invoice snapshot while that same payment push is still writing its invoice.
// Insert directly at the pull function boundary because earlier guards may have
// changed the existing refresh condition into a more complex expression.
if (!src.includes('PAYMENT_PUSH_PULL_RACE_GUARD')) {
  const pullStart = '    const pull = async (bootstrap = false) => {';
  must(src.includes(pullStart), 'Cloud pull function missing');
  src = src.replace(
    pullStart,
    `${pullStart}\n      // PAYMENT_PUSH_PULL_RACE_GUARD\n      if (pushing.current) return;`
  );
}

// Collector audit rows are append-only. Re-sending an existing row through a
// normal UPSERT can require UPDATE permission and make a later payment push fail.
if (!src.includes('PAYMENT_COLLECTOR_APPEND_ONLY_AUDIT')) {
  const auditRe = /(^\s*)const \{ error \} = await supabase\.from\('generator_audit_logs'\)\.upsert\(rows, \{ onConflict: 'generator_id,id' \}\);\n\1if \(error\) throw error;/m;
  const match = src.match(auditRe);
  if (match) {
    const indent = match[1] || '';
    src = src.replace(
      auditRe,
      `${indent}// PAYMENT_COLLECTOR_APPEND_ONLY_AUDIT\n${indent}if (session?.role === 'collector') {\n${indent}  const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id', ignoreDuplicates: true });\n${indent}  if (error) throw error;\n${indent}} else {\n${indent}  const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id' });\n${indent}  if (error) throw error;\n${indent}}`
    );
  }
}

// Verify the dangerous collector-wide deletes are either gone or owner-scoped.
const unsafeSubscriberDelete = /await replaceMissingRows\('generator_subscribers'/.test(src) &&
  !/PAYMENT_COLLECTOR_NO_DESTRUCTIVE_RECONCILE[\s\S]{0,220}session\?\.role === 'generator_admin'[\s\S]{0,220}replaceMissingRows\('generator_subscribers'/.test(src);
const unsafeInvoiceDelete = /await replaceMissingRows\('generator_invoices'/.test(src) &&
  !/PAYMENT_COLLECTOR_NO_INVOICE_RECONCILE[\s\S]{0,220}session\?\.role === 'generator_admin'[\s\S]{0,220}replaceMissingRows\('generator_invoices'/.test(src);

must(!unsafeSubscriberDelete, 'Unsafe collector subscriber reconciliation remains');
must(!unsafeInvoiceDelete, 'Unsafe collector invoice reconciliation remains');
must(src.includes('PAYMENT_PUSH_PULL_RACE_GUARD') && src.includes('if (pushing.current) return;'), 'Payment push/pull race guard missing');

// The audit guard is required only while the plain generic audit UPSERT survives.
const genericAuditUpsertRemains = /const \{ error \} = await supabase\.from\('generator_audit_logs'\)\.upsert\(rows, \{ onConflict: 'generator_id,id' \}\);/.test(src);
if (genericAuditUpsertRemains && !src.includes('PAYMENT_COLLECTOR_APPEND_ONLY_AUDIT')) {
  throw new Error('Collector append-only audit guard missing');
}

write(src);
console.log('Applied cloud-safe payment persistence: payment writes cannot be overwritten mid-flight, collector reconciliation is non-destructive, and audit retries are append-only when needed.');

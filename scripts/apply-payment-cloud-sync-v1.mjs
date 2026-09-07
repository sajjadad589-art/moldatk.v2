import fs from 'node:fs';

const path = 'src/lib/useGeneratorCloudSync.ts';
const read = () => fs.readFileSync(path, 'utf8');
const write = content => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

let src = read();

// Collectors only see their assigned cabins. They must never run the owner's
// destructive reconciliation over the entire generator subscriber/invoice set.
const subscriberDelete = "        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));";
if (src.includes(subscriberDelete) && !src.includes('PAYMENT_COLLECTOR_NO_DESTRUCTIVE_RECONCILE')) {
  src = src.replace(
    subscriberDelete,
    `        // PAYMENT_COLLECTOR_NO_DESTRUCTIVE_RECONCILE\n        if (session?.role === 'generator_admin') {\n          await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));\n        }`
  );
}

const invoiceDelete = "        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));";
if (src.includes(invoiceDelete) && !src.includes('PAYMENT_COLLECTOR_NO_INVOICE_RECONCILE')) {
  src = src.replace(
    invoiceDelete,
    `        // PAYMENT_COLLECTOR_NO_INVOICE_RECONCILE\n        if (session?.role === 'generator_admin') {\n          await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));\n        }`
  );
}

// A realtime event fired by our own subscriber upsert must not pull the old
// invoice snapshot while the same payment push is still in progress.
src = src.replace(
  '      if (refreshing.current) return;\n      refreshing.current = true;',
  `      if (refreshing.current || pushing.current) return;\n      refreshing.current = true;`
);

// Collector audit entries are append-only. Re-sending an existing audit row with
// UPSERT would require UPDATE permission and can poison every later payment sync.
const auditUpsert = "          const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id' });\n          if (error) throw error;";
if (src.includes(auditUpsert)) {
  src = src.replace(
    auditUpsert,
    `          if (session?.role === 'collector') {\n            const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id', ignoreDuplicates: true });\n            if (error) throw error;\n          } else {\n            const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id' });\n            if (error) throw error;\n          }`
  );
}

must(src.includes('PAYMENT_COLLECTOR_NO_DESTRUCTIVE_RECONCILE'), 'Collector subscriber reconciliation guard missing');
must(src.includes('PAYMENT_COLLECTOR_NO_INVOICE_RECONCILE'), 'Collector invoice reconciliation guard missing');
must(src.includes('if (refreshing.current || pushing.current) return;'), 'Payment push/pull race guard missing');
must(src.includes('ignoreDuplicates: true'), 'Collector append-only audit guard missing');

write(src);
console.log('Applied cloud-safe payment persistence: collectors cannot delete unseen rows, payment pushes cannot be overwritten mid-flight, and collector audit retries are append-only.');

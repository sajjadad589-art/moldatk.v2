import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

fs.mkdirSync('.test-output', { recursive: true });
const source = fs.readFileSync('src/lib/syncConflictResolution.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
fs.writeFileSync('.test-output/syncConflictResolution.mjs', compiled, 'utf8');

const {
  isUniqueViolation,
  canonicalizeSubscriberRows,
  remapInvoiceSubscriberIds,
  canonicalizeLiveInvoiceRows,
  canonicalizeTariffRows,
} = await import('../.test-output/syncConflictResolution.mjs');

assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint' }), true);
assert.equal(isUniqueViolation({ status: 409 }), true);
assert.equal(isUniqueViolation({ code: '400' }), false);

const subscriber = canonicalizeSubscriberRows(
  [{ id: 'local-s1', generator_id: 'g1', code: '170', full_name: 'Local name' }],
  [{ id: 'cloud-s1', code: '170' }],
);
assert.equal(subscriber.rows.length, 1);
assert.equal(subscriber.rows[0].id, 'cloud-s1');
assert.equal(subscriber.aliases.get('local-s1'), 'cloud-s1');

const remapped = remapInvoiceSubscriberIds([
  { id: 'local-invoice', subscriber_id: 'local-s1', month_id: '2026-09', status: 'paid', paid_amount: 76000 },
], subscriber.aliases);
assert.equal(remapped[0].subscriber_id, 'cloud-s1');

const invoices = canonicalizeLiveInvoiceRows(remapped, [
  { id: 'cloud-invoice', subscriber_id: 'cloud-s1', month_id: '2026-09', status: 'unpaid' },
]);
assert.equal(invoices.length, 1);
assert.equal(invoices[0].id, 'cloud-invoice');
assert.equal(invoices[0].paid_amount, 76000);

const duplicateLocalLive = canonicalizeLiveInvoiceRows([
  { id: 'i-old', subscriber_id: 'cloud-s1', month_id: '2026-10', status: 'unpaid', paid_amount: 0 },
  { id: 'i-new', subscriber_id: 'cloud-s1', month_id: '2026-10', status: 'partial', paid_amount: 20000 },
], []);
assert.equal(duplicateLocalLive.length, 1);
assert.equal(duplicateLocalLive[0].id, 'i-new');

const tariff = canonicalizeTariffRows([
  { id: 'local-2026-09', year: 2026, month: 9, tiers: [{ type: 'normal', pricePerAmpere: 12000 }] },
], [{ id: 'cloud-2026-09', year: 2026, month: 9 }]);
assert.equal(tariff.rows.length, 1);
assert.equal(tariff.rows[0].id, 'cloud-2026-09');
assert.equal(tariff.aliases.get('local-2026-09'), 'cloud-2026-09');

const hook = fs.readFileSync('src/lib/useEventDrivenGeneratorSync.ts', 'utf8');
assert(hook.includes("client.rpc('delete_generator_tariff_month'"), 'tariff deletion must remain accounting-safe');
assert(hook.includes("window.addEventListener('pagehide', pagehide)"), 'BFCache pagehide cleanup missing');
assert(hook.includes("window.addEventListener('pageshow', pageshow)"), 'BFCache pageshow reconnect missing');
assert(hook.includes('blockedConflictRevision'), 'duplicate-conflict retry breaker missing');
assert(!hook.includes("remove('generator_monthly_tariffs', sent.deletedTariffs)"), 'raw tariff delete must not return');

console.log('Sync conflict regression passed: subscriber code, live invoice month, tariff period, 23505/409 breaker and BFCache reconnect are protected.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = p => fs.readFileSync(p, 'utf8');

const sync = read('src/lib/useEventDrivenGeneratorSync.ts');
assert.ok(sync.includes("client.rpc('delete_generator_tariff_month'"), 'tariff deletion must use accounting RPC');
assert.ok(!sync.includes("remove('generator_monthly_tariffs', sent.deletedTariffs)"), 'raw tariff deletion would leave hidden debt');

const payment = read('src/components/PaymentMethodModal.tsx');
assert.ok(payment.includes('step={1}'), 'custom payment must accept any whole IQD amount');
assert.ok(payment.includes("max={selectedMethod === 'lump' ? lumpMaximum : totalAmountDue}"), 'lump max must be current invoice remaining');
assert.ok(payment.includes('<form noValidate onSubmit={handleApplyPayment}'), 'browser native range validation must not block valid custom payment');
assert.ok(payment.includes("const maxAllowed = selectedMethod === 'lump' ? lumpMaximum : totalAmountDue;"), 'explicit payment bounds missing');
assert.ok(payment.includes('getInvoiceRemaining(activeInvoice)'), 'lump must read current invoice ledger');

const pos = read('src/components/POSQuickView.tsx');
assert.ok(pos.includes('activeMonthId={activeMonthId}'), 'collector payment modal must receive authoritative active month');

const owner = read('src/components/SubscriberModal.tsx');
assert.ok(owner.includes("max={customPaymentMode === 'lump' ? settlementCurrentRemaining : outstanding}"), 'owner lump max must be current invoice remaining');

const sql = read('supabase/migrations/20260915065000_financial_integrity_tariff_deletion.sql');
assert.ok(sql.includes('delete_generator_tariff_month'), 'server tariff deletion RPC missing from migration source');
assert.ok(sql.includes('current_remaining'), 'reconcile must keep current invoice balance separate from carried debt');
assert.ok(sql.includes('MOLDATK_TARIFF_DELETED_SETTLED_HISTORY'), 'paid history preservation marker missing');
assert.ok(sql.includes("status not in ('cancelled','free')"), 'invoice liability filter missing');

console.log('Financial integrity static regression passed: server deletion, lump bounds, and build-time guard are wired.');

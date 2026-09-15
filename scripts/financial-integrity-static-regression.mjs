import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = p => fs.readFileSync(p, 'utf8');

const sync = read('src/lib/useEventDrivenGeneratorSync.ts');
assert.ok(sync.includes("client.rpc('delete_generator_tariff_month'"), 'tariff deletion must use accounting RPC');
assert.ok(!sync.includes("remove('generator_monthly_tariffs', sent.deletedTariffs)"), 'raw tariff deletion would leave hidden debt');

const payment = read('src/components/PaymentMethodModal.tsx');
assert.ok(payment.includes('step={1}'), 'custom payment must accept any whole IQD amount');
assert.ok(payment.includes("max={selectedMethod === 'lump' ? lumpMaximum : totalAmountDue}"), 'custom payment bounds missing');
assert.ok(payment.includes('const lumpMaximum = Math.max(0, totalAmountDue);'), 'lump ceiling must be the subscriber total debt');
assert.ok(payment.includes('<form noValidate onSubmit={handleApplyPayment}'), 'browser native range validation must not block valid custom payment');
assert.ok(payment.includes("const maxAllowed = selectedMethod === 'lump' ? lumpMaximum : totalAmountDue;"), 'explicit payment bounds missing');

const accounting = read('src/utils/monthlyAccounting.ts');
assert.ok(accounting.includes('applyLumpSettlementAllDebt'), 'canonical all-debt lump settlement engine missing');
assert.ok(accounting.includes('MOLDATK_LUMP_SETTLEMENT_ALL_DEBT'), 'lump settlement audit marker missing');

const pos = read('src/components/POSQuickView.tsx');
assert.ok(pos.includes('COLLECTOR_LUMP_SETTLEMENT_V2_ALL_DEBT'), 'collector does not use all-debt lump settlement');
assert.ok(pos.includes('totalOutstandingAfter: 0'), 'collector lump receipt can still expose debt');
assert.ok(pos.includes("paymentStatus: 'paid'"), 'collector lump does not force fully paid status');

const owner = read('src/components/SubscriberModal.tsx');
assert.ok(owner.includes('applyLumpSettlementAllDebt'), 'owner does not use canonical lump settlement');
assert.ok(owner.includes('totalOutstandingAfter: 0'), 'owner lump receipt can still expose debt');
assert.ok(owner.includes("max={outstanding}"), 'owner lump amount is not bounded by total debt');

const app = read('src/App.tsx');
assert.ok(app.includes('FINANCIAL_DELETE_LOCAL_CLEANUP_V2'), 'local tariff deletion debt cleanup missing');
assert.ok(app.includes('extinguishDeletedTariffLiabilities'), 'deleted tariff liabilities are not cleared locally');

const deleteSql = read('supabase/migrations/20260915065000_financial_integrity_tariff_deletion.sql');
assert.ok(deleteSql.includes('delete_generator_tariff_month'), 'server tariff deletion RPC missing from migration source');
assert.ok(deleteSql.includes('current_remaining'), 'reconcile must keep current invoice balance separate from carried debt');
assert.ok(deleteSql.includes('MOLDATK_TARIFF_DELETED_SETTLED_HISTORY'), 'paid history preservation marker missing');

const opsSql = read('supabase/migrations/20260915071500_financial_operations_hardening.sql');
assert.ok(opsSql.includes("auth.role() = 'service_role'"), 'service-role destructive operations are still blocked by collector triggers');
assert.ok(opsSql.includes('delete_generator_subscriber_permanent'), 'atomic permanent subscriber delete RPC missing');
assert.ok(opsSql.includes('reset_generator_account_operational_data'), 'atomic account reset RPC missing');
assert.ok(opsSql.includes('generator_cashbox_entries'), 'account reset does not clear cashbox entries');
assert.ok(opsSql.includes('generator_cashbox_resets'), 'account reset does not clear cashbox reset state');

const adminFn = read('supabase/functions/generator-data-admin/index.ts');
assert.ok(adminFn.includes('delete_generator_subscriber_permanent'), 'Edge Function does not use atomic subscriber delete');
assert.ok(adminFn.includes('reset_generator_account_operational_data'), 'Edge Function does not use atomic operational reset');

console.log('Financial integrity static regression passed: lump settlement, tariff deletion, subscriber deletion and account reset are production-guarded.');

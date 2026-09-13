import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const app = read('src/App.tsx');
const reports = read('src/components/mobile/MobileMonthlyReports.tsx');
const pricing = read('src/components/PricingModal.tsx');
const reset = read('src/components/SecureSystemReset.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const superAdmin = read('src/components/SuperAdminDashboard.tsx');

// Owner factory reset must not be exposed anywhere in the product UI.
assert(reset.includes('SecureSystemReset: React.FC<Props> = () => null'), 'Owner factory reset compatibility component must render nothing');
assert(!reset.includes('تصفير النظام بالكامل'), 'Owner factory reset button text must not exist');
assert(!reset.includes('تصفير جميع بيانات مولدتك'), 'Owner factory reset confirmation phrase must not exist');
assert(!reset.includes('<button'), 'Owner factory reset component must not render any button');

// Keep the backend implementation protected even though there is no owner-facing UI path.
assert(app.includes("supabase.auth.signInWithPassword({ email, password })"), 'Legacy protected reset backend must remain re-authenticated if retained');
assert(app.includes("userSession?.role !== 'generator_admin'"), 'Any retained reset backend must remain owner-only');
assert(sync.includes('moldatk_factory_reset_in_progress'), 'Cloud sync reset guard must remain intact');
assert(app.includes("action: 'delete_subscriber'"), 'Permanent subscriber delete action missing');
assert(app.includes('handleDeleteSubscriberPermanent'), 'Subscriber delete callbacks are not centralized');
assert(superAdmin.includes("supabase.functions.invoke('purge-generator-account'"), 'Super Admin account deletion must use the permanent purge backend');
assert(!superAdmin.includes("action: 'delete_account'"), 'Legacy partial generator delete action is still wired in the final UI');

// The account/subscription identity must never be removed by owner-side application code.
assert(!app.includes("supabase.from('generator_subscriptions').delete"), 'Owner subscription must not be deleted by owner application code');
assert(!app.includes('supabase.auth.admin.deleteUser'), 'Owner client must never delete Auth users directly');

// Annual report reset is a presentation/accounting-period reset, not a debt erase.
assert(reports.includes('reportResetMarkers'), 'Reports must support annual reset markers');
assert(reports.includes('تصفير حسابات سنة'), 'Annual reset control must be visible in reports');
assert(app.includes("title: 'تصفير تقارير السنة'"), 'Annual reset must be persisted in audit history');
assert(app.includes('بدون حذف الديون أو الفواتير الأصلية'), 'Annual reset must explicitly preserve source debts/invoices');

// Any tariff may be removed, including the active and final tariff. Removing tariff metadata
// must preserve historical invoices/debts, while an empty list zeros only the live collection state.
assert(pricing.includes('title="حذف تسعيرة هذا الشهر"'), 'Every tariff must expose a delete control');
assert(pricing.includes("onSaveMonthlyTariffs([], '', false);"), 'The final tariff must be deletable');
assert(pricing.includes('الفواتير والتسديدات والديون السابقة سيبقى محفوظاً'), 'Tariff delete warning must preserve accounting history');
assert(!pricing.includes('لا يمكن حذف آخر تسعيرة موجودة'), 'No last-tariff deletion guard may remain');
assert(!pricing.includes("onSaveMonthlyTariffs(updated, nextActive.id, true);"), 'Deleting a tariff must never regenerate subscriber bills');
assert(app.includes("getStorageKey('moldatk_deleted_tariffs')"), 'Tariff deletion must create durable tombstones');
assert(app.includes('normalized.length === 0'), 'Empty tariff list must have an explicit live-zero path');
assert(sync.includes('.filter(t => !deletedTariffSet.has(t.id))'), 'Deleted tariffs must not resurrect from cloud pull');

console.log('Secure destructive controls audit passed: owner factory reset UI is absent, subscriber/generator purge wiring remains protected, annual report reset remains non-destructive, and tariff history safeguards are intact.');

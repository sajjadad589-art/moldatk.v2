import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const app = read('src/App.tsx');
const reports = read('src/components/mobile/MobileMonthlyReports.tsx');
const pricing = read('src/components/PricingModal.tsx');
const reset = read('src/components/SecureSystemReset.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');

// Full reset protection.
assert(reset.includes("const CONFIRM_PHRASE = 'تصفير جميع بيانات مولدتك'"), 'Exact destructive confirmation phrase is required');
assert(reset.includes('useState(10)'), 'Destructive reset must have a 10-second guard');
assert(reset.includes('password.length > 0'), 'Password entry is required before arming reset');
assert(app.includes("supabase.auth.signInWithPassword({ email, password })"), 'Owner password must be re-authenticated by Supabase');
assert(app.includes("userSession?.role !== 'generator_admin'"), 'Full reset must be owner-only');
assert(app.includes('moldatk_emergency_backup_last_'), 'Emergency local backup must be retained');
assert(app.includes("a.download = 'moldatk-backup-before-reset-'"), 'Automatic downloadable backup must be created');
assert(app.includes(".delete().eq('generator_id', generatorId)"), 'Cloud deletes must be generator-scoped');
assert(sync.includes('moldatk_factory_reset_in_progress'), 'Cloud sync must pause during destructive reset');

// Full reset scope must include all core accounting/business tables, while auth/subscription are intentionally preserved.
for (const table of [
  'generator_invoices',
  'generator_subscribers',
  'generator_lines',
  'generator_monthly_tariffs',
  'generator_audit_logs',
  'generator_settings',
]) {
  assert(app.includes(`'${table}'`), `Full reset must clear ${table}`);
}
assert(!app.includes("supabase.from('generator_subscriptions').delete"), 'Owner subscription must not be deleted');
assert(!app.includes('supabase.auth.admin.deleteUser'), 'Owner login must not be deleted');

// Annual report reset is a presentation/accounting-period reset, not a debt erase.
assert(reports.includes('reportResetMarkers'), 'Reports must support annual reset markers');
assert(reports.includes('تصفير حسابات سنة'), 'Annual reset control must be visible in reports');
assert(app.includes("title: 'تصفير تقارير السنة'"), 'Annual reset must be persisted in audit history');
assert(app.includes('بدون حذف الديون أو الفواتير الأصلية'), 'Annual reset must explicitly preserve source debts/invoices');

// Any tariff may be removed. Deleting the tariff record is metadata-only: accounting invoices/debts remain.
assert(pricing.includes('title="حذف تسعيرة هذا الشهر"'), 'Every tariff must expose a delete control');
assert(pricing.includes('tariffs.length > 1 && ('), 'Delete icon should be available on all tariff records when another record exists');
assert(pricing.includes('onSaveMonthlyTariffs(updated, nextActive.id, false);'), 'Tariff deletion must save metadata without recalculating/removing ledgers');
assert(pricing.includes('الفواتير والتسديدات والديون'), 'Tariff delete warning must explicitly preserve accounting history');
assert(!pricing.includes("onSaveMonthlyTariffs(updated, nextActive.id, true);"), 'Deleting a tariff must never regenerate subscriber bills');

console.log('Secure destructive controls audit passed: owner re-auth, typed phrase, timer, backups, scoped reset, annual reports reset, and metadata-only delete-any-tariff protection.');

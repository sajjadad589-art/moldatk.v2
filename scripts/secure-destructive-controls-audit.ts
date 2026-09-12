import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const app = read('src/App.tsx');
const reports = read('src/components/mobile/MobileMonthlyReports.tsx');
const pricing = read('src/components/PricingModal.tsx');
const reset = read('src/components/SecureSystemReset.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const superAdmin = read('src/components/SuperAdminDashboard.tsx');

// Full reset protection.
assert(reset.includes("const CONFIRM_PHRASE = 'تصفير جميع بيانات مولدتك'"), 'Exact destructive confirmation phrase is required');
assert(reset.includes('useState(10)'), 'Destructive reset must have a 10-second guard');
assert(reset.includes('password.length > 0'), 'Password entry is required before arming reset');
assert(app.includes("supabase.auth.signInWithPassword({ email, password })"), 'Owner password must be re-authenticated by Supabase');
assert(app.includes("userSession?.role !== 'generator_admin'"), 'Full reset must be owner-only');
assert(app.includes('moldatk_emergency_backup_last_'), 'Emergency local backup must be retained');
assert(app.includes("a.download = 'moldatk-backup-before-reset-'"), 'Desktop downloadable backup must remain available');
assert(app.includes('const isIOSBrowser = /iPad|iPhone|iPod/i.test(navigator.userAgent)'), 'iOS reset must detect Safari/WebView');
assert(app.includes('const shouldAutoDownloadBackup = !isIOSBrowser && !Capacitor.isNativePlatform()'), 'iOS/native reset must not auto-open the JSON backup preview');
assert(app.includes("console.info('Reset backup kept safely inside Moldatk; automatic file preview skipped on iOS/native app.')"), 'Mobile reset must preserve backup without navigating away');
assert(sync.includes('moldatk_factory_reset_in_progress'), 'Cloud sync must pause during destructive reset');
assert(app.includes("supabase.functions.invoke('generator-data-admin'"), 'Full reset must run through the protected generator data Edge Function');
assert(app.includes("action: 'reset_generator_data'"), 'Cloud-authoritative reset action missing');
assert(app.includes("action: 'delete_subscriber'"), 'Permanent subscriber delete action missing');
assert(app.includes('handleDeleteSubscriberPermanent'), 'Subscriber delete callbacks are not centralized');
assert(superAdmin.includes("supabase.functions.invoke('purge-generator-account'"), 'Super Admin account deletion must use the permanent purge backend');
assert(!superAdmin.includes("action: 'delete_account'"), 'Legacy partial generator delete action is still wired in the final UI');

// The account/subscription identity is intentionally preserved by an owner factory reset.
assert(!app.includes("supabase.from('generator_subscriptions').delete"), 'Owner subscription must not be deleted by owner factory reset');
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

console.log('Secure destructive controls audit passed: password + 10s protection, backup, cloud-authoritative factory reset, permanent subscriber/generator purge wiring, annual report reset, and tariff history safeguards are intact.');

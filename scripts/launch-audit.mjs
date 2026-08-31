import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const main = read('src/main.tsx');
const login = read('src/components/LoginView.tsx');
const app = read('src/App.tsx');
const mobileSubscribers = read('src/components/mobile/MobileSubscribers.tsx');
const pos = read('src/components/POSQuickView.tsx');
const cloud = read('src/lib/useGeneratorCloudSync.ts');
const updaterManifest = JSON.parse(read('public/app-version.json'));
const androidGradle = read('android/app/build.gradle');
const workflow = read('.github/workflows/android-apk.yml');

assert(!main.includes("return <CollectorApp"), 'Legacy CollectorApp route is still reachable.');
assert(!main.includes("route.includes('col')"), 'Unsafe broad collector route alias is still enabled.');
assert(login.includes('loginCollectorWithCloud'), 'Collector login is not using Supabase cloud authentication.');
assert(!login.includes("c.passcode || '1234'"), 'Collector login still contains the default 1234 PIN fallback.');
assert(app.includes("VITE_ENABLE_NATIVE_PUSH === 'true'"), 'Native push feature flag is missing.');
assert(app.includes('!ENABLE_NATIVE_PUSH'), 'Native push is not guarded and may crash Android without Firebase.');
assert(!mobileSubscribers.includes('onTogglePaymentStatus(sub.id);'), 'Mobile payment button is still wired to the old no-op handler.');
assert(pos.includes('inv.totalAmount'), 'POS unpaid totals are not using SubscriberInvoice.totalAmount.');
assert(!pos.includes('inv.amount - (inv.paidAmount'), 'POS still references the invalid invoice amount property.');
assert(pos.includes('collectorPermissions'), 'Collector permissions are not enforced in POS UI.');
assert(cloud.includes("from('generator_invoices')"), 'Invoice history is missing from cloud synchronization.');
assert(cloud.includes("session?.role === 'collector'"), 'Collector sessions are missing from cloud synchronization.');
assert(!cloud.includes("await replaceMissingRows('generator_subscribers'"), 'Subscriber sync still contains destructive inferred deletion.');
assert(!cloud.includes("await replaceMissingRows('generator_invoices'"), 'Invoice sync still contains destructive inferred deletion.');
assert(Number.isInteger(updaterManifest.versionCode) && updaterManifest.versionCode > 0, 'Invalid Android update versionCode.');

if (workflow.includes('assembleDebug')) {
  assert(updaterManifest.enabled === false, 'Automatic public updates must stay disabled while CI publishes debug-signed APKs.');
}
assert(/versionCode\s+\d+/.test(androidGradle), 'Android versionCode is missing.');
assert(/versionName\s+"[^"]+"/.test(androidGradle), 'Android versionName is missing.');

if (failures.length) {
  console.error('\nPRE-LAUNCH AUDIT FAILED:\n');
  failures.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exit(1);
}

console.log('Pre-launch invariant audit passed.');

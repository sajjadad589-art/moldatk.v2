import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const app = read('src/App.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const superAdmin = read('src/components/SuperAdminDashboard.tsx');
const gradle = read('android/app/build.gradle');
const versionManifest = JSON.parse(read('public/app-version.json'));

assert(app.includes("supabase.functions.invoke('generator-data-admin'"), 'owner data mutations are not protected by generator-data-admin');
assert(app.includes("action: 'reset_generator_data'"), 'factory reset is not server-authoritative');
assert(app.includes("action: 'delete_subscriber'"), 'subscriber permanent delete action missing');
assert(app.includes("supabase.functions.invoke('generator-data-cleanup'"), 'remaining generator-scoped cleanup backend is not wired');
assert(app.includes("action: 'reset_extras'"), 'factory reset extra operational cleanup missing');
assert(app.includes("action: 'delete_subscriber_extras'"), 'subscriber AI/entity cleanup missing');
assert(app.includes('const handleDeleteSubscriberPermanent = async (subId: string) =>'), 'central permanent subscriber delete handler missing');
assert(app.includes('onDeleteSubscriber={handleDeleteSubscriberPermanent}'), 'subscriber delete UI is not bound to permanent handler');
assert(!app.includes("for (const table of ['generator_invoices', 'generator_subscribers'"), 'legacy client-side partial reset is still active');
assert(app.includes("localStorage.setItem(markerKey, '1')"), 'factory reset does not freeze cloud sync');
assert(app.includes("window.dispatchEvent(new Event('moldatk-local-sync'))"), 'post-purge local/cloud reconciliation event missing');
assert(sync.includes('moldatk_factory_reset_in_progress'), 'cloud sync reset guard missing');
assert(superAdmin.includes("supabase.functions.invoke('purge-generator-account'"), 'Super Admin generator delete is not a full purge');
assert(!superAdmin.includes("action: 'delete_account'"), 'legacy partial generator delete action remains');
assert(/versionCode\s+33\b/.test(gradle), 'versionCode 33 missing');
assert(/versionName\s+"1\.3\.29"/.test(gradle), 'versionName 1.3.29 missing');
assert.equal(versionManifest.versionCode, 33, 'update manifest versionCode mismatch');
assert.equal(versionManifest.versionName, '1.3.29', 'update manifest versionName mismatch');
assert.equal(versionManifest.minimumVersionCode, 33, 'mandatory update minimum version mismatch');

console.log('Permanent data purge regression passed: factory reset, subscriber deletion and generator-account purge are cloud-authoritative, extended cleanup is wired, and release 1.3.29 is aligned.');

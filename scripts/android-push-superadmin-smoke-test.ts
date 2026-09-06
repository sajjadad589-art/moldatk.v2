import fs from 'node:fs';

const fail = (message: string): never => { throw new Error(message); };
const read = (path: string) => fs.readFileSync(path, 'utf8');

const firebase = JSON.parse(read('android/app/google-services.json'));
const packageName = firebase?.client?.[0]?.client_info?.android_client_info?.package_name;
if (packageName !== 'com.mwaldatk.app') fail(`Firebase package mismatch: ${packageName || 'missing'}`);

const manifest = read('android/app/src/main/AndroidManifest.xml');
if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) fail('POST_NOTIFICATIONS permission missing');

const app = read('src/App.tsx');
if (!app.includes("['generator_admin', 'collector', 'super_admin', 'super_admin_manager']")) {
  fail('Android push is not enabled for all authenticated app roles');
}

const superAdmin = read('src/components/SuperAdminDashboard.tsx');
if (!superAdmin.includes('SUPER_ADMIN_AUTH_READY_V1')) fail('Super Admin auth readiness guard missing');
if (!superAdmin.includes('supabase.auth.onAuthStateChange')) fail('Super Admin auth restore listener missing');

console.log('Android Firebase config, notification permission, push role registration, and Super Admin auth recovery: OK');

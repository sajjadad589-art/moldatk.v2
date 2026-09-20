import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const login = read('src/components/LoginView.tsx');
const auth = read('src/lib/authAccounts.ts');
const app = read('src/App.tsx');
const types = read('src/types.ts');
const edge = read('supabase/functions/moldatk-auth/index.ts');
const migration = read('supabase/migrations/20260920090000_saved_account_passkeys.sql');

assert.match(login, /loadSavedLoginAccounts/);
assert.match(login, /loginWithPasskey/);
assert.match(login, /registerPasskeyForCurrentAccount/);
assert.match(login, /إضافة حساب آخر/);
assert.match(login, /تابع لـ/);
assert.match(login, //brand/moldatk-mark\.svg/);
assert.match(login, /forceSuperAdmin/);
assert.doesNotMatch(login, /صاحب المولد<\/span>.*جابي \/ كادر/s);

assert.match(auth, /moldatk_saved_login_accounts_v2/);
assert.match(auth, /navigator\.credentials\.create/);
assert.match(auth, /navigator\.credentials\.get/);
assert.match(auth, /passkey-auth-options/);
assert.match(auth, /passkey-register-options/);
assert.match(auth, /supabase\.auth\.verifyOtp/);
assert.doesNotMatch(auth, /passwordInput|passcode:/);

assert.match(app, /QUICK_LOGIN_LOCK_V2/);
assert.match(app, /moldatk_session_unlocked_v2/);
assert.match(types, /authUserId\?: string/);
assert.match(types, /generatorName\?: string/);
assert.match(types, /ownerName\?: string/);

assert.match(edge, /password-login/);
assert.match(edge, /passkey-register-options/);
assert.match(edge, /passkey-auth-verify/);
assert.match(edge, /generateRegistrationOptions/);
assert.match(edge, /verifyAuthenticationResponse/);
assert.match(edge, /use_super_admin_portal/);
assert.match(edge, /admin\.auth\.admin\.generateLink/);
assert.match(edge, /type: "magiclink"/);

assert.match(migration, /moldatk_passkeys/);
assert.match(migration, /moldatk_webauthn_challenges/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.moldatk_passkeys from anon, authenticated/);

console.log('Saved account + passkey login regression: OK');

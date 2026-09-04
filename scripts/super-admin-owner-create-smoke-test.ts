import assert from 'node:assert/strict';
import fs from 'node:fs';

const c = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf8');

assert(c.includes('const [generatorFormError, setGeneratorFormError]'), 'Owner modal must keep a visible local error state');
assert(c.includes('role="alert"'), 'Owner modal must render validation/backend errors inside the dialog');
assert(c.includes("style={{ colorScheme: 'light' }}"), 'Owner form must force light native controls');
assert(c.includes('bg-white text-slate-900 placeholder:text-slate-400'), 'Owner fields must have readable light colors');
assert(c.includes('<button type="submit" disabled={creatingGenerator}'), 'Create account button must be an explicit submit button');
assert(c.includes('const duplicateGenerator = generators.find'), 'Duplicate generator login emails must be detected before calling the Edge Function');
assert(c.includes("serverMessage = payload?.error || payload?.message"), 'Non-2xx Edge Function errors must be surfaced to the user');
assert(c.includes("إيميل تسجيل الدخول مستخدم مسبقاً"), 'Duplicate email must have a clear Arabic error');

console.log('Super Admin owner-create smoke test passed: readable fields, explicit submit, duplicate-email protection, and visible server errors.');

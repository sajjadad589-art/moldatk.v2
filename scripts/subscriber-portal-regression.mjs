import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const read = path => fs.readFileSync(path, 'utf8');

const main = read('src/main.tsx');
const receipt = read('src/components/InvoiceReceiptModal.tsx');
const portal = read('src/components/SubscriberPortalPage.tsx');
const sunmi = read('android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java');
const migration = read('supabase/migrations/20260919110000_subscriber_portal_qr.sql');

assert.match(main, /\/s\\\/\(\[0-9a-fA-F-\]\{36\}\)/, 'subscriber QR route is missing');
assert.match(receipt, /ensureSubscriberPortalLink/, 'receipt must request a secure portal token');
assert.match(receipt, /portalQrDataUrl/, 'browser receipt QR is missing');
assert.match(receipt, /generatorId\?: string \| null/, 'receipt must be scoped to generator id');
assert.match(sunmi, /MOLDATK_NATIVE_SUBSCRIBER_QR_V1/, 'SUNMI QR rendering is missing');
assert.match(sunmi, /decodeQrDataUrl/, 'SUNMI QR decoder is missing');
assert.match(portal, /get_public_subscriber_account/, 'portal must use the public allowlisted RPC');
assert.doesNotMatch(portal, /subscriber\?\.phone|subscriber\?\.address|subscriber\?\.notes/, 'portal UI must not expose private subscriber fields');

assert.match(migration, /revoke all on table public\.subscriber_portal_tokens from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.get_public_subscriber_account\(uuid\) to anon, authenticated, service_role/i);
assert.match(migration, /collector_has_permission\(p_generator_id, 'canPrintReceipts'\)/);
assert.doesNotMatch(migration, /'phone'\s*,\s*v_sub\.phone/i, 'public RPC must not return phone');
assert.doesNotMatch(migration, /'address'\s*,\s*v_sub\.address/i, 'public RPC must not return address');
assert.doesNotMatch(migration, /'notes'\s*,\s*v_sub\.notes/i, 'public RPC must not return notes');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url && key) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const randomToken = crypto.randomUUID();
  const { data, error } = await client.rpc('get_public_subscriber_account', { p_token: randomToken });
  assert.ifError(error);
  assert.equal(data?.ok, false, 'unknown bearer token must not reveal an account');
  assert.equal(data?.reason, 'not_found');
}

console.log('Subscriber portal regression: PASS (secure token route, sanitized RPC, browser QR and SUNMI QR).');

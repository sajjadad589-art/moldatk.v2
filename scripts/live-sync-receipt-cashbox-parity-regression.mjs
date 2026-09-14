import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');

const sync = read('src/lib/useEventDrivenGeneratorSync.ts');
assert.ok(sync.includes("channel.on('postgres_changes'"), 'online sync must use Supabase Realtime');
assert.ok(sync.includes("window.addEventListener('online', sync.request);"), 'reconnect must trigger one queued sync flight');
assert.ok(!sync.includes('setInterval('), 'generator sync must not poll on an interval');
assert.ok(!sync.includes("document.addEventListener('visibilitychange', visibility)"), 'visibility changes must not cause recurring full pulls');
assert.ok(sync.includes("message: active ? 'مزامنة التغييرات المحفوظة'"), 'live/offline sync states must be explicit');
assert.ok(!sync.includes("progress: active ? 20 : pending ? 0 : 100"), 'normal live sync must not emit repeating 100% loading states');

const indicator = read('src/components/SyncProgressIndicator.tsx');
assert.ok(indicator.includes("'مزامنة حية'"), 'online idle badge must say live sync');
assert.ok(indicator.includes("'غير متصل — محفوظ محلياً'"), 'offline badge must confirm local persistence');
assert.ok(!indicator.includes('setInterval(resolveTarget, 400)'), 'sync badge must not poll the DOM');

const receipt = read('src/components/InvoiceReceiptModal.tsx');
for (const label of ['استحقاق الشهر الحالي', 'الإجمالي قبل التسديد', 'تسديد الشهر الحالي']) {
  assert.ok(!receipt.includes(`<Row label="${label}"`), `visual receipt still contains ${label}`);
}
assert.ok(receipt.includes('id="thermal-receipt-printable"'), 'canonical receipt DOM missing');
assert.ok(receipt.includes('${receipt.outerHTML}'), 'browser/portable printing must use the visible canonical receipt');
assert.ok(receipt.includes("currentCharge: ''"), 'native receipt must suppress current charge row');
assert.ok(receipt.includes("totalBeforePayment: ''"), 'native receipt must suppress before-payment total row');
assert.ok(receipt.includes("appliedToCurrentMonth: ''"), 'native receipt must suppress current-month allocation row');

const nativeReceipt = read('android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java');
for (const label of ['استحقاق الشهر الحالي', 'الإجمالي قبل التسديد', 'تسديد الشهر الحالي']) {
  assert.ok(!nativeReceipt.includes(`addField(lines, "${label}"`), `native receipt still prints ${label}`);
}
assert.equal((nativeReceipt.match(/"المبلغ المستلم/g) || []).length, 1, 'native receipt must print received amount once');

const wallet = read('src/components/WalletView.tsx');
assert.ok(wallet.includes('(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString'), 'unfiltered wallet headline must use authoritative cashbox');
const dashboard = read('src/components/DashboardView.tsx');
assert.ok(dashboard.includes('const totalCollectedRevenue = useCashboxBalance('), 'desktop dashboard must use the same cashbox hook');
const mobile = read('src/components/mobile/MobileLayout.tsx');
assert.ok(mobile.includes('const mobileCashboxAmount = useCashboxBalance('), 'mobile dashboard must use the same cashbox hook');
const cashboxHook = read('src/lib/useCashboxBalance.ts');
assert.ok(cashboxHook.includes('state?.balance != null && Number.isFinite(value)'), 'all cashbox surfaces must share cached server balance on first paint');
assert.ok(cashboxHook.includes("supabase.rpc('get_generator_cashbox'"), 'cashbox hook must read the server-authoritative RPC');

console.log('Live sync, canonical receipt, and cashbox parity regression passed.');

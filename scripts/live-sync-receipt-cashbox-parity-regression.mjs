import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');

const sync = read('src/lib/useEventDrivenGeneratorSync.ts');
assert.ok(sync.includes("channel.on('postgres_changes'"), 'online sync must use Supabase Realtime');
assert.ok(sync.includes("window.addEventListener('online', sync.request);"), 'reconnect must trigger one queued sync flight');
assert.ok(!sync.includes('setInterval('), 'generator sync must not poll on an interval');
assert.ok(!sync.includes("document.addEventListener('visibilitychange', visibility)"), 'visibility changes must not cause recurring full pulls');
assert.ok(sync.includes("'تعديلات بانتظار المزامنة'") && sync.includes("'تعذر إكمال المزامنة'"), 'live/offline sync states must be explicit');
assert.ok(!sync.includes("progress: active ? 20 : pending ? 0 : 100"), 'normal live sync must not emit repeating 100% loading states');

const indicator = read('src/components/SyncProgressIndicator.tsx');
assert.ok(indicator.includes("'مزامنة حية'"), 'online idle badge must say live sync');
assert.ok(indicator.includes("'غير متصل — محفوظ محلياً'"), 'offline badge must confirm local persistence');
assert.ok(!indicator.includes('setInterval(resolveTarget, 400)'), 'sync badge must not poll the DOM');

const receipt = read('src/components/InvoiceReceiptModal.tsx');
const receiptTemplate = read('src/lib/invoiceTemplate.ts');
assert.ok(receipt.includes('MOLDATK_RECEIPT_TEMPLATE_V2'), 'configurable receipt renderer marker missing');
assert.ok(receipt.includes('receipt-system-brand text-center'), 'receipt brand block must remain centered when enabled');
assert.ok(receipt.includes('template.systemBrandText'), 'brand text must come from receipt settings');
assert.ok(receipt.includes('template.showPricePerAmp'), 'ampere price visibility must be configurable');
assert.ok(receipt.includes('template.showCurrentCharge'), 'current-month due visibility must be configurable');
assert.ok(receipt.includes('template.showAppliedToPreviousDebt'), 'previous-debt allocation visibility must be configurable');
assert.ok(receipt.includes('template.showFooterNotes'), 'custom receipt note visibility must be configurable');
assert.ok(receipt.includes('template.footerNotes'), 'custom receipt note text must feed the renderer');
assert.ok(receipt.includes('template.showQr'), 'QR visibility must be configurable');
assert.ok(receipt.includes('receipt-amount text-xl'), 'received amount box must use compact amount typography');
assert.ok(receipt.includes('id="thermal-receipt-printable"'), 'canonical receipt DOM missing');
assert.ok(receipt.includes('${receipt.outerHTML}'), 'browser/portable printing must use the visible canonical receipt');
assert.ok(receipt.includes("pricePerAmp: pricePerAmp > 0 ? formatCurrency(pricePerAmp) : ''"), 'native receipt payload must include ampere price');
assert.ok(receipt.includes('showAppliedToPreviousDebt: template.showAppliedToPreviousDebt'), 'native payload must use the same previous-debt visibility switch');
assert.ok(receiptTemplate.includes("systemBrandText: 'مولدتك'"), 'default Moldatk brand text must remain مولدتك');
assert.ok(receiptTemplate.includes("showAppliedToPreviousDebt: false"), 'previous-debt allocation stays hidden by default');
assert.ok(receiptTemplate.includes("showCurrentCharge: true"), 'current charge stays visible by default');
assert.ok(receiptTemplate.includes("showPricePerAmp: true"), 'monthly ampere price stays visible by default');

const nativeReceipt = read('android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java');
assert.ok(nativeReceipt.includes('MOLDATK_NATIVE_SUBSCRIBER_QR_V2'), 'native configurable receipt marker missing');
assert.ok(nativeReceipt.includes('String systemTitle = val(r, "systemTitle", "مولدتك")'), 'native brand title must use configurable payload with Moldatk fallback');
assert.ok(nativeReceipt.includes('if (showPricePerAmp && !pricePerAmp.isEmpty())'), 'native monthly ampere price must obey visibility setting');
assert.ok(nativeReceipt.includes('if (showCurrentCharge && !currentCharge.isEmpty())'), 'native current-month due must obey visibility setting');
assert.ok(nativeReceipt.includes('if (showAppliedToPreviousDebt && !appliedToPreviousDebt.isEmpty())'), 'native previous-debt allocation must obey visibility setting');
assert.ok(nativeReceipt.includes('if (showFooterNotes && !note.isEmpty())'), 'native custom note must obey visibility setting');
assert.ok(nativeReceipt.includes('Bitmap subscriberQr = showQr ? decodeQrDataUrl'), 'native QR must obey visibility setting');
assert.ok(nativeReceipt.includes('val(r, "receivedAmountLabel", "المبلغ المستلم") + "\\n" + finalAmount'), 'native amount box must use configurable label and compact typography');

const wallet = read('src/components/WalletView.tsx');
assert.ok(wallet.includes('(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString'), 'unfiltered wallet headline must use authoritative cashbox');
const dashboard = read('src/components/DashboardView.tsx');
assert.ok(dashboard.includes('const totalCollectedRevenue = useCashboxBalance('), 'desktop dashboard must use the same cashbox hook');
const mobile = read('src/components/mobile/MobileLayout.tsx');
assert.ok(mobile.includes('const mobileCashboxAmount = useCashboxBalance('), 'mobile dashboard must use the same cashbox hook');
const cashboxHook = read('src/lib/useCashboxBalance.ts');
assert.ok(cashboxHook.includes('state?.balance != null && Number.isFinite(value)'), 'all cashbox surfaces must share cached server balance on first paint');
assert.ok(cashboxHook.includes("supabase.rpc('get_generator_cashbox'"), 'cashbox hook must read the server-authoritative RPC');

// Reset must remain usable even when an unrelated sync flight is temporarily failing.
const app = read('src/App.tsx');
assert.ok(app.includes('Cashbox reset continuing after sync flush warning'), 'cashbox reset must not be blocked by sync flush failure');
assert.ok(app.includes("new Error('sync_flush_timeout')"), 'cashbox reset must bound the best-effort sync wait');
assert.ok(app.includes('await resetCashbox(generatorId)'), 'cashbox reset RPC call missing');
const cashboxCloud = read('src/lib/cashboxCloud.ts');
assert.ok(cashboxCloud.includes('UUID_RE'), 'cashbox reset must reject malformed stale request ids');
assert.ok(cashboxCloud.includes("typeof crypto.randomUUID === 'function'"), 'cashbox reset must support native randomUUID when available');
assert.ok(cashboxCloud.includes('crypto.getRandomValues'), 'cashbox reset must support older PWA/WebView UUID fallback');
assert.ok(cashboxCloud.includes('supabase.auth.refreshSession()'), 'cashbox reset must retry once after stale auth');
assert.ok(cashboxCloud.includes("supabase.rpc('reset_generator_cashbox'"), 'cashbox reset server RPC missing');

console.log('Live sync, agreed receipt content, cashbox parity, and resilient reset regression passed.');

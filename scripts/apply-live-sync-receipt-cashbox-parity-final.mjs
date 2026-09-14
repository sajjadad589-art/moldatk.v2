import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, message) => { if (!ok) throw new Error(`Live sync/receipt/cashbox finalizer: ${message}`); };

// ---------------------------------------------------------------------------
// 1) ONLINE = live/event-driven and silent. OFFLINE = durable local queue.
//    No polling spinner and no recurring "100%" completion animation.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);

  s = s.replace(
`const progress = (active: boolean, pending = false) => window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {
  detail: { active, pending, progress: active ? 20 : pending ? 0 : 100,
    message: active ? 'جاري المزامنة' : pending ? 'تعديلات محفوظة — أعد المحاولة عند توفر الاتصال' : 'اكتملت المزامنة' },
}));`,
`const progress = (active: boolean, pending = false) => window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {
  // LIVE_SYNC_UI_V1: normal online realtime traffic is intentionally silent.
  // Offline changes stay durable locally; reconnect performs one scheduler flight.
  detail: { active, pending, progress: active ? 20 : 0,
    message: active ? 'مزامنة التغييرات المحفوظة' : pending ? 'محفوظ محلياً — بانتظار الاتصال' : 'مزامنة حية' },
}));`
  );

  // The scheduler itself is still single-flight/debounced, but normal online events
  // must not flash a loading state for every realtime notification.
  s = s.replace(
`    progress(true);
    try {
      if (pending()) await push(snapshot());`,
`    try {
      if (pending()) await push(snapshot());`
  );

  // A tab becoming visible does not need a full pull: the realtime channel is the
  // authoritative live feed. This also prevents focus/visibility churn from looking
  // like repeated synchronization.
  s = s.replace(`    const visibility = () => { if (document.visibilityState === 'visible') sync.request(); };\n`, '');
  s = s.replace(`    document.addEventListener('visibilitychange', visibility);\n`, '');
  s = s.replace(`      document.removeEventListener('visibilitychange', visibility);\n`, '');

  must(s.includes('LIVE_SYNC_UI_V1'), 'live-sync UI marker missing');
  must(!s.includes('progress(true);\n    try {\n      if (pending())'), 'normal scheduler still starts visible progress');
  must(!s.includes("document.addEventListener('visibilitychange', visibility)"), 'visibility polling-style pull still enabled');
  must(s.includes("window.addEventListener('online', sync.request);"), 'one-shot reconnect trigger missing');
  must(s.includes("channel.on('postgres_changes'"), 'Supabase realtime subscription missing');
  must(!s.includes('setInterval('), 'sync runtime contains polling interval');
  write(p, s);
}

{
  const p = 'src/components/SyncProgressIndicator.tsx';
  let s = read(p);

  // Stop checking the portal every 400ms forever. Resolve immediately and then use a
  // short-lived MutationObserver only while the header slot has not mounted yet.
  s = s.replace(
`  useEffect(() => {
    const resolveTarget = () => setPortalTarget(document.getElementById('moldatk-sync-status-slot'));
    resolveTarget();
    const timer = window.setInterval(resolveTarget, 400);
    return () => window.clearInterval(timer);
  }, []);`,
`  useEffect(() => {
    const existing = document.getElementById('moldatk-sync-status-slot');
    if (existing) { setPortalTarget(existing); return; }
    const observer = new MutationObserver(() => {
      const target = document.getElementById('moldatk-sync-status-slot');
      if (target) { setPortalTarget(target); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);`
  );

  s = s.replace(
`  const completed = state.online && !state.pending && state.progress >= 100;
  const label = !state.online
    ? 'غير متصل بالإنترنت'
    : state.syncing || completed
      ? \`جاري المزامنة \${Math.max(1, state.progress)}%\`
      : state.pending
        ? 'بانتظار المزامنة'
        : 'متصل بالإنترنت';`,
`  const completed = false;
  const label = !state.online
    ? 'غير متصل — محفوظ محلياً'
    : state.syncing
      ? 'مزامنة التغييرات المحفوظة'
      : state.pending
        ? 'بانتظار الاتصال'
        : 'مزامنة حية';`
  );

  s = s.replace(': state.syncing || completed\n      ? \'border-blue-200', ': state.syncing\n      ? \'border-blue-200');
  s = s.replace(': state.syncing || completed\n      ? \'bg-blue-500 animate-pulse\'', ': state.syncing\n      ? \'bg-blue-500 animate-pulse\'');

  must(!s.includes('setInterval(resolveTarget, 400)'), 'sync badge still polls DOM');
  must(s.includes("'مزامنة حية'"), 'live-sync idle label missing');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 2) One canonical receipt content. Remove the three requested accounting rows
//    from screen, browser/portable print, and native SUNMI bitmap print.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/InvoiceReceiptModal.tsx';
  let s = read(p);

  const forbiddenRows = [
    `            <Row label="استحقاق الشهر الحالي" value={formatCurrency(currentCharge)} strong />\n`,
    `            <Row label="الإجمالي قبل التسديد" value={formatCurrency(totalBeforePayment)} strong />\n`,
    `            {appliedToCurrentMonth > 0 && <Row label="تسديد الشهر الحالي" value={formatCurrency(appliedToCurrentMonth)} />}\n`,
  ];
  for (const row of forbiddenRows) s = s.replace(row, '');

  // Native receipt gets the same reduced content; empty values are not rendered.
  s = s.replace('          currentCharge: formatCurrency(currentCharge),', "          currentCharge: '',");
  s = s.replace('          totalBeforePayment: formatCurrency(totalBeforePayment),', "          totalBeforePayment: '',");
  s = s.replace("          appliedToCurrentMonth: appliedToCurrentMonth > 0 ? formatCurrency(appliedToCurrentMonth) : '',", "          appliedToCurrentMonth: '',");

  // Keep sharing consistent with the receipt the customer sees.
  s = s.replace('      `استحقاق الشهر الحالي: ${formatCurrency(currentCharge)}`,\n', '');
  s = s.replace('      `الإجمالي قبل التسديد: ${formatCurrency(totalBeforePayment)}`,\n', '');
  s = s.replace("      appliedToCurrentMonth > 0 ? `تسديد الشهر الحالي: ${formatCurrency(appliedToCurrentMonth)}` : '',\n", '');

  must(!s.includes('<Row label="استحقاق الشهر الحالي"'), 'current-charge row still visible');
  must(!s.includes('<Row label="الإجمالي قبل التسديد"'), 'before-payment total row still visible');
  must(!s.includes('<Row label="تسديد الشهر الحالي"'), 'current-month allocation row still visible');
  must(s.includes('id="thermal-receipt-printable"'), 'canonical browser receipt DOM missing');
  must(s.includes('${receipt.outerHTML}'), 'browser print no longer clones canonical receipt');
  write(p, s);
}

{
  const p = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
  let s = read(p);

  s = s.replace(/\n\s*String currentCharge = raw\(r, "currentCharge"\);\n\s*if \(!currentCharge\.isEmpty\(\)\) addField\(lines, "استحقاق الشهر الحالي", currentCharge, true\);/g, '');
  s = s.replace(/\n\s*String totalBeforePayment = raw\(r, "totalBeforePayment"\);\n\s*if \(!totalBeforePayment\.isEmpty\(\)\) addField\(lines, "الإجمالي قبل التسديد", totalBeforePayment, true\);/g, '');
  s = s.replace(/\n\s*String appliedToCurrentMonth = raw\(r, "appliedToCurrentMonth"\);\n\s*if \(!appliedToCurrentMonth\.isEmpty\(\)\) addField\(lines, "تسديد الشهر الحالي", appliedToCurrentMonth, false\);/g, '');

  // Native output previously printed "المبلغ المستلم" twice. Keep only the final
  // boxed amount, matching the visual receipt hierarchy.
  s = s.replace(/\n\s*if \(!finalAmount\.isEmpty\(\)\) \{\n\s*lines\.add\(new DrawLine\("المبلغ المستلم", 19f, true, Layout\.Alignment\.ALIGN_NORMAL, 1\)\);\n\s*lines\.add\(new DrawLine\(finalAmount, 29f, true, Layout\.Alignment\.ALIGN_NORMAL, 7\)\);\n\s*\}/g, '');

  must(!s.includes('addField(lines, "استحقاق الشهر الحالي"'), 'native current-charge row still printed');
  must(!s.includes('addField(lines, "الإجمالي قبل التسديد"'), 'native before-payment row still printed');
  must(!s.includes('addField(lines, "تسديد الشهر الحالي"'), 'native current-month allocation row still printed');
  must((s.match(/"المبلغ المستلم/g) || []).length === 1, 'native receipt still prints received amount more than once');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 3) Dashboard and cashbox screen must display the exact same authoritative RPC
//    balance. Filters may show a filtered subtotal, but the unfiltered cashbox is
//    always the shared useCashboxBalance value.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/WalletView.tsx';
  let s = read(p);
  s = s.replace(
`              {totalCollected.toLocaleString('en-US')} {currency}`,
`              {(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString('en-US')} {currency}`
  );
  must(s.includes('(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString'), 'wallet headline is not bound to authoritative cashbox');
  write(p, s);
}

{
  const p = 'src/lib/useCashboxBalance.ts';
  let s = read(p);
  // Cache is valid whether or not a reset has ever occurred. This removes a first-paint
  // discrepancy where dashboard and wallet used different local fallbacks before RPC returned.
  s = s.replace('      return state?.reset_at && Number.isFinite(value) ? value : null;', '      return state?.balance != null && Number.isFinite(value) ? value : null;');
  must(s.includes('state?.balance != null && Number.isFinite(value)'), 'cashbox cached first-paint parity missing');
  write(p, s);
}

console.log('Installed silent live sync, canonical receipt content, and dashboard/cashbox single-source parity.');

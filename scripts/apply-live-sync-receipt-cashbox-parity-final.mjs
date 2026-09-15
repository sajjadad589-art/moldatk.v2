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
// 2) Canonical receipt content — apply ONLY the agreed receipt corrections:
//    * keep the Moldatk brand centered at the top
//    * show monthly ampere price + current-month due
//    * remove only the "تسديد الدين السابق" allocation row
//    * make the received-amount box more compact
//    Browser/portable print clones the same visible receipt; SUNMI mirrors it.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/InvoiceReceiptModal.tsx';
  let s = read(p);

  // Monthly ampere price belongs with subscriber/month details.
  if (!s.includes('<Row label="سعر الأمبير الشهري"')) {
    s = s.replace(
      `            {amperes > 0 && <Row label="عدد الأمبيرات" value={\`${'${'}formatNumberArabic(amperes)} أمبير\`} />}\n`,
      `            {amperes > 0 && <Row label="عدد الأمبيرات" value={\`${'${'}formatNumberArabic(amperes)} أمبير\`} />}\n            {pricePerAmp > 0 && <Row label="سعر الأمبير الشهري" value={formatCurrency(pricePerAmp)} strong />}\n`
    );
  }

  // Native payload must carry the actual monthly ampere price.
  s = s.replace("          pricePerAmp: '',", "          pricePerAmp: pricePerAmp > 0 ? formatCurrency(pricePerAmp) : '',");

  // Remove ONLY the previous-debt allocation line from the customer receipt/share.
  s = s.replace(`            {appliedToPreviousDebt > 0 && <Row label="تسديد الدين السابق" value={formatCurrency(appliedToPreviousDebt)} />}\n`, '');
  s = s.replace("          appliedToPreviousDebt: appliedToPreviousDebt > 0 ? formatCurrency(appliedToPreviousDebt) : '',", "          appliedToPreviousDebt: '',");
  s = s.replace("      appliedToPreviousDebt > 0 ? `تسديد الدين السابق: ${formatCurrency(appliedToPreviousDebt)}` : '',\n", '');

  // Compact received-amount box: label above, amount below, still clearly readable.
  s = s.replace(
    '#thermal-receipt-printable .receipt-total{font-size:26px!important;font-weight:900!important;border:2px solid #000!important;padding:8px 4px!important}',
    '#thermal-receipt-printable .receipt-total{font-size:14px!important;font-weight:900!important;border:2px solid #000!important;padding:6px 4px!important}#thermal-receipt-printable .receipt-total .receipt-amount{font-size:22px!important;line-height:1.15!important}'
  );
  s = s.replace(
    '<div className="text-2xl font-black tracking-tight">{formatCurrency(paymentAmount)}</div>',
    '<div className="receipt-amount text-xl font-black tracking-tight leading-tight">{formatCurrency(paymentAmount)}</div>'
  );

  // The agreed current-month due row must remain visible.
  must(s.includes('<Row label="استحقاق الشهر الحالي" value={formatCurrency(currentCharge)} strong />'), 'current-month due row missing');
  must(s.includes('<Row label="سعر الأمبير الشهري"'), 'monthly ampere price row missing');
  must(!s.includes('<Row label="تسديد الدين السابق"'), 'previous-debt allocation row still visible');
  must(s.includes('receipt-system-brand text-center'), 'Moldatk brand is not centered');
  must(s.includes('>مولدتك</div>'), 'Moldatk brand text changed');
  must(s.includes('receipt-amount text-xl'), 'compact received-amount styling missing');
  must(s.includes('id="thermal-receipt-printable"'), 'canonical browser receipt DOM missing');
  must(s.includes('${receipt.outerHTML}'), 'browser print no longer clones canonical receipt');
  write(p, s);
}

{
  const p = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
  let s = read(p);

  // Add monthly ampere price to the native 58mm receipt if it is not already wired.
  if (!s.includes('addField(lines, "سعر الأمبير الشهري"')) {
    s = s.replace(
      `        String amperes = raw(r, "amperes");\n        if (!amperes.isEmpty()) addField(lines, "عدد الأمبيرات", amperes, false);\n`,
      `        String amperes = raw(r, "amperes");\n        if (!amperes.isEmpty()) addField(lines, "عدد الأمبيرات", amperes, false);\n\n        String pricePerAmp = raw(r, "pricePerAmp");\n        if (!pricePerAmp.isEmpty()) addField(lines, "سعر الأمبير الشهري", pricePerAmp, true);\n`
    );
  }

  // Native output previously printed "المبلغ المستلم" once outside the box and once
  // inside it. Keep only the final compact boxed amount.
  s = s.replace(/\n\s*if \(!finalAmount\.isEmpty\(\)\) \{\n\s*lines\.add\(new DrawLine\("المبلغ المستلم", 19f, true, Layout\.Alignment\.ALIGN_NORMAL, 1\)\);\n\s*lines\.add\(new DrawLine\(finalAmount, 29f, true, Layout\.Alignment\.ALIGN_NORMAL, 7\)\);\n\s*\}/g, '');

  // Remove only the previous-debt allocation row.
  s = s.replace(/\n\s*String appliedToPreviousDebt = raw\(r, "appliedToPreviousDebt"\);\n\s*if \(!appliedToPreviousDebt\.isEmpty\(\)\) addField\(lines, "تسديد الدين السابق", appliedToPreviousDebt, false\);/g, '');

  // Keep the label above and amount below, but reduce the overall box typography.
  s = s.replace(
    'lines.add(new DrawLine("المبلغ المستلم\\n" + finalAmount, 31f, true, Layout.Alignment.ALIGN_CENTER, 10, true));',
    'lines.add(new DrawLine("المبلغ المستلم\\n" + finalAmount, 25f, true, Layout.Alignment.ALIGN_CENTER, 8, true));'
  );

  must(s.includes('new DrawLine("مولدتك", 31f, true, Layout.Alignment.ALIGN_CENTER'), 'native Moldatk title not centered');
  must(s.includes('addField(lines, "سعر الأمبير الشهري"'), 'native monthly ampere price missing');
  must(s.includes('addField(lines, "استحقاق الشهر الحالي"'), 'native current-month due missing');
  must(!s.includes('addField(lines, "تسديد الدين السابق"'), 'native previous-debt allocation still printed');
  must((s.match(/"المبلغ المستلم/g) || []).length === 1, 'native receipt still prints received amount more than once');
  must(s.includes('"المبلغ المستلم\\n" + finalAmount, 25f'), 'native compact amount box missing');
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

console.log('Installed silent live sync, agreed receipt corrections, and dashboard/cashbox single-source parity.');

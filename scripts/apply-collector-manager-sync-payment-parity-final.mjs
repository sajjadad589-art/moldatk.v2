import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Collector/manager parity finalizer: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Collector payment UI: full + custom/partial + true lump settlement only.
//    Free/exemption remains owner-side and is never exposed to collectors.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);

  s = s.replace(
    "type CustomPaymentMethod = '' | 'partial' | 'lump' | 'free';",
    "type CustomPaymentMethod = '' | 'partial' | 'lump';"
  );

  s = s.replace(
    /\} else if \(value === 'free'\) \{\s*setSelectedMethod\('free'\);\s*setPartialAmount\(0\);\s*\} else \{/,
    `} else {`
  );

  s = s.replace(/\s*<option value="free">تسديد مجاني<\/option>/g, '');
  s = s.replace('جزئي، مقطوع، أو مجاني', 'تسديد مخصص أو تسديد مقطوع');
  s = s.replace('<option value="partial">تسديد جزئي</option>', '<option value="partial">تسديد مخصص — دفعة جزئية</option>');
  s = s.replace(/تأكيد التسديد الجزئي/g, 'تأكيد التسديد المخصص');
  s = s.replace(/مبلغ التسديد الجزئي:/g, 'مبلغ التسديد المخصص:');
  s = s.replace("      : 'تأكيد التسديد المجاني';", "      : 'تأكيد التسديد';");
  s = s.replace("    if (selectedMethod === 'free' && !reason.trim()) return;\n", '');
  s = s.replace("      freeReason: selectedMethod === 'free' ? reason.trim() : undefined,\n", '');

  const freePanelStart = s.indexOf("          {selectedMethod === 'free' && customPaymentOpen && (");
  if (freePanelStart >= 0) {
    const nextBlock = s.indexOf('          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">', freePanelStart);
    must(nextBlock > freePanelStart, 'could not remove collector free-payment panel safely');
    s = s.slice(0, freePanelStart) + s.slice(nextBlock);
  }

  s = s.replace(
    '<div className="text-[11px] text-slate-500 dark:text-slate-400">تسديد مخصص أو تسديد مقطوع</div>',
    '<div className="text-[11px] text-slate-500 dark:text-slate-400">مخصص: يبقى المتبقي ديناً • مقطوع: يغلق الشهر بالمبلغ المتفق عليه</div>'
  );

  must(s.includes("'lump'"), 'lump method missing from collector payment flow');
  must(s.includes('تسديد مخصص'), 'custom payment label missing from collector UI');
  must(s.includes('تسديد مقطوع'), 'lump payment label missing from collector UI');
  must(!s.includes('<option value="free">'), 'free payment option still visible to collector');
  must(!s.includes("selectedMethod === 'free' && customPaymentOpen"), 'free payment panel still visible to collector');

  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Race-safe cloud sync. A subscriber save and its audit row are two consecutive local
//    writes. If the audit write lands while a push is active, queue a second push instead
//    of letting the first push snapshot a change that it never actually uploaded.
// -----------------------------------------------------------------------------
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let s = read(p);

  if (!s.includes('const pendingPush = useRef(false);')) {
    s = s.replace(
      '  const pushing = useRef(false);',
      '  const pushing = useRef(false);\n  const pendingPush = useRef(false);'
    );
  }

  const pushStart = s.indexOf('    const push = async () => {');
  const pullStart = pushStart >= 0 ? s.indexOf('\n\n    const pull = async', pushStart) : -1;
  must(pushStart >= 0 && pullStart > pushStart, 'cloud push block not found');

  let block = s.slice(pushStart, pullStart);

  // Historical build patches vary the guard slightly (some include refreshing.current),
  // so match any one-line push guard that contains pushing.current.
  if (!block.includes('pendingPush.current = true')) {
    block = block.replace(
      /\s*if\s*\([^\n;]*pushing\.current[^\n;]*\)\s*return;/,
      `\n      if (!ready.current || disposed) return;\n      if (pushing.current) { pendingPush.current = true; return; }`
    );
  }

  if (!block.includes('const pushedSnapshot = snapshot();')) {
    block = block.replace(
      '      pushing.current = true;',
      `      pushing.current = true;\n      pendingPush.current = false;\n      const pushedSnapshot = snapshot();\n      let pushSucceeded = false;`
    );
  }

  if (!block.includes('lastSnapshot.current = pushedSnapshot')) {
    block = block.replace(
      '        lastSnapshot.current = snapshot();',
      `        lastSnapshot.current = pushedSnapshot;\n        pushSucceeded = true;`
    );
  }

  if (!block.includes('queueMicrotask(() => { void push(); })')) {
    block = block.replace(
      /\} finally \{\s*pushing\.current = false;\s*\}/,
      `} finally {\n        pushing.current = false;\n        if (pushSucceeded && !disposed && ready.current && (pendingPush.current || snapshot() !== lastSnapshot.current)) {\n          pendingPush.current = false;\n          queueMicrotask(() => { void push(); });\n        }\n      }`
    );
  }

  must(block.includes('pendingPush.current = true'), 'active-push queue guard missing');
  must(block.includes('const pushedSnapshot = snapshot();'), 'pushed snapshot capture missing');
  must(block.includes('lastSnapshot.current = pushedSnapshot'), 'push snapshot race still present');
  must(block.includes('queueMicrotask(() => { void push(); })'), 'queued follow-up push missing');

  s = s.slice(0, pushStart) + block + s.slice(pullStart);

  // Shared operational data used by manager and collector must go through the same cloud
  // source and realtime pull path.
  for (const needle of [
    "supabase.from('generator_subscribers').upsert",
    "supabase.from('generator_invoices').upsert",
    "supabase.from('generator_audit_logs').upsert",
    "table: 'generator_subscribers'",
    "table: 'generator_invoices'",
    "table: 'generator_audit_logs'",
    'payment_status: s.paymentStatus',
    'amount_due: Number(s.amountDue || 0)',
    'amount_paid: Number(s.amountPaid || 0)',
    'remaining_amount: Number(i.remainingAmount || 0)',
    'collector_name: i.collectorName || null',
    'notes: i.notes || null',
    'receipt_number: i.receiptNumber || null',
  ]) must(s.includes(needle), `sync mapping missing: ${needle}`);

  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Push audit changes immediately too. This makes the payment method, collector name,
//    amount and settlement description arrive with the financial update.
// -----------------------------------------------------------------------------
{
  const p = 'src/App.tsx';
  let s = read(p);
  const start = s.indexOf('  const addAuditLog = (entry: any) => {');
  const end = start >= 0 ? s.indexOf('\n\n  const ', start + 10) : -1;
  must(start >= 0 && end > start, 'addAuditLog handler not found');
  let block = s.slice(start, end);

  if (!block.includes("window.dispatchEvent(new Event('moldatk-local-sync'))")) {
    block = block.replace(
      "      try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated)); } catch (e) {}",
      "      try {\n        localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}"
    );
  }

  must(block.includes("window.dispatchEvent(new Event('moldatk-local-sync'))"), 'audit log does not trigger immediate sync');
  s = s.slice(0, start) + block + s.slice(end);
  write(p, s);
}

// -----------------------------------------------------------------------------
// 4) Final build-breaking QA invariants.
// -----------------------------------------------------------------------------
{
  const pos = read('src/components/POSQuickView.tsx');
  const pay = read('src/components/PaymentMethodModal.tsx');
  const sync = read('src/lib/useGeneratorCloudSync.ts');
  const app = read('src/App.tsx');

  must(pos.includes('COLLECTOR_LUMP_SETTLEMENT_V1'), 'collector lump-settlement accounting branch missing');
  must(pos.includes('applyPaymentOldestFirst'), 'collector custom/partial payment ledger allocation missing');
  must(pos.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2'), 'free subscribers are not protected from collector flow');
  must(pay.includes('تسديد مخصص'), 'collector custom payment missing');
  must(pay.includes('تسديد مقطوع'), 'collector lump payment missing');
  must(!pay.includes('<option value="free">'), 'collector free-payment option reappeared');
  must(sync.includes('COLLECTOR_SYNC_FREE_GUARD_V2'), 'collector safe cloud write guard missing');
  must(sync.includes('pendingPush.current = true'), 'queued synchronization guard missing');
  must(sync.includes('lastSnapshot.current = pushedSnapshot'), 'sync completion can still swallow concurrent writes');
  must(app.includes("localStorage.setItem(getStorageKey('moldatk_audit_logs')"), 'shared audit persistence missing');
}

console.log('Collector/manager parity finalized: subscriber, debt, invoice and audit sync is race-safe; collector has custom + lump settlement and no free-payment UI.');

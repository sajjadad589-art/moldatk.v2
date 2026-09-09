import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Collector/manager parity finalizer: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Collector payment UI: keep full payment + custom payment + true lump settlement.
//    Do not expose free/exempt settlement to collectors.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);

  // The previous accounting finalizer adds the true lump method. Keep the internal
  // legacy `free` execution type for compatibility with older handlers, but remove it
  // from the collector-facing custom-method selector and all visible UI.
  s = s.replace(
    "type CustomPaymentMethod = '' | 'partial' | 'lump' | 'free';",
    "type CustomPaymentMethod = '' | 'partial' | 'lump';"
  );

  // Remove the now-unreachable free branch from the custom-method switch so TypeScript
  // never compares the narrowed collector-only type to `free`.
  s = s.replace(
    /\} else if \(value === 'free'\) \{\s*setSelectedMethod\('free'\);\s*setPartialAmount\(0\);\s*\} else \{/,
    `} else {`
  );

  // Clear any remaining collector-facing free option and terminology.
  s = s.replace(/\s*<option value="free">تسديد مجاني<\/option>/g, '');
  s = s.replace('جزئي، مقطوع، أو مجاني', 'تسديد مخصص أو تسديد مقطوع');
  s = s.replace('<option value="partial">تسديد جزئي</option>', '<option value="partial">تسديد مخصص — دفعة جزئية</option>');
  s = s.replace(/تأكيد التسديد الجزئي/g, 'تأكيد التسديد المخصص');
  s = s.replace(/مبلغ التسديد الجزئي:/g, 'مبلغ التسديد المخصص:');
  s = s.replace("      : 'تأكيد التسديد المجاني';", "      : 'تأكيد التسديد';");
  s = s.replace("    if (selectedMethod === 'free' && !reason.trim()) return;\n", '');
  s = s.replace("      freeReason: selectedMethod === 'free' ? reason.trim() : undefined,\n", '');

  // Remove the visible free/exemption details panel completely. The collector page must
  // never present an exemption action; owner-side exemption behavior remains untouched.
  const freePanelStart = s.indexOf("          {selectedMethod === 'free' && customPaymentOpen && (");
  if (freePanelStart >= 0) {
    const nextBlock = s.indexOf('          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">', freePanelStart);
    must(nextBlock > freePanelStart, 'could not remove collector free-payment panel safely');
    s = s.slice(0, freePanelStart) + s.slice(nextBlock);
  }

  // Make the distinction explicit to the collector: custom = partial/debt remains;
  // lump = negotiated amount that closes only the current subscription.
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
// 2) Close a real sync race: a payment save dispatches local-sync before its audit row
//    is written. Previously the active push could finish and snapshot the newer local
//    state, incorrectly marking that audit/payment detail as synced even though it was
//    never included in that push. Queue one more push whenever local state changes while
//    a push is active.
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
  block = block.replace(
    '      if (!ready.current || pushing.current || disposed) return;',
    `      if (!ready.current || disposed) return;\n      if (pushing.current) { pendingPush.current = true; return; }`
  );

  if (!block.includes('const pushedSnapshot = snapshot();')) {
    block = block.replace(
      '      pushing.current = true;',
      `      pushing.current = true;\n      pendingPush.current = false;\n      const pushedSnapshot = snapshot();\n      let pushSucceeded = false;`
    );
  }

  block = block.replace(
    '        lastSnapshot.current = snapshot();',
    `        lastSnapshot.current = pushedSnapshot;\n        pushSucceeded = true;`
  );

  block = block.replace(
    /      \} finally \{\s*        pushing\.current = false;\s*      \}/,
    `      } finally {\n        pushing.current = false;\n        // If another local write (for example the audit row immediately after a payment)\n        // happened while this push was running, push it immediately instead of falsely\n        // considering it part of the completed snapshot.\n        if (pushSucceeded && !disposed && ready.current && (pendingPush.current || snapshot() !== lastSnapshot.current)) {\n          pendingPush.current = false;\n          queueMicrotask(() => { void push(); });\n        }\n      }`
  );

  must(block.includes('pendingPush.current = true'), 'active-push queue guard missing');
  must(block.includes('lastSnapshot.current = pushedSnapshot'), 'push snapshot race still present');
  must(block.includes('queueMicrotask(() => { void push(); })'), 'queued follow-up push missing');

  s = s.slice(0, pushStart) + block + s.slice(pullStart);

  // Verify the shared generator sync actually carries the operational fields both pages need.
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
// 3) Audit rows are part of the manager/collector shared state. Dispatch sync as soon
//    as a log is written so payment method, collector name, received amount and settlement
//    description follow the subscriber/invoice update without waiting for the timer.
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
// 4) Final accounting/payment invariants after every historical build-time mutation.
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
  must(app.includes("localStorage.setItem(getStorageKey('moldatk_audit_logs')"), 'shared audit persistence missing');
}

console.log('Collector/manager parity finalized: realtime payment/debt/invoice/audit sync is race-safe; collector has custom + lump settlement and no free-payment UI.');

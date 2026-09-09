import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Live finance reconciliation: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Monthly ledger integrity: a permanent free/exempt subscriber can never carry a
//    paid/unpaid monetary invoice. Normalize any old malformed invoice before it can
//    affect a dashboard, be pushed back to cloud, or be reused by a later month pass.
// -----------------------------------------------------------------------------
{
  const p = 'src/utils/monthlyAccounting.ts';
  let s = read(p);

  if (!s.includes('FREE_INVOICE_INTEGRITY_V1')) {
    const historyAnchor = "    const history = [...(sub.invoicesHistory || [])].map(inv => ({ ...inv }));";
    must(s.includes(historyAnchor), 'activateMonthlyTariff history anchor missing');
    s = s.replace(historyAnchor, `${historyAnchor}\n\n    // FREE_INVOICE_INTEGRITY_V1\n    if (isFree) {\n      for (const inv of history) {\n        if (inv.status === 'cancelled') continue;\n        inv.tier = 'free';\n        inv.pricePerAmpere = 0;\n        inv.fixedFee = 0;\n        inv.totalAmount = 0;\n        inv.paidAmount = 0;\n        inv.remainingAmount = 0;\n        inv.status = 'free';\n      }\n    }`);

    const ensureAnchor = "  const existing = [...(subscriber.invoicesHistory || [])].map(inv => ({ ...inv }));";
    must(s.includes(ensureAnchor), 'ensureMonthInvoice existing-history anchor missing');
    s = s.replace(ensureAnchor, `${ensureAnchor}\n  const freeSubscriber = subscriber.tier === 'free' || subscriber.isExempted === true || subscriber.paymentStatus === 'free';\n  if (freeSubscriber) {\n    for (const inv of existing) {\n      if (inv.status === 'cancelled') continue;\n      inv.tier = 'free';\n      inv.pricePerAmpere = 0;\n      inv.fixedFee = 0;\n      inv.totalAmount = 0;\n      inv.paidAmount = 0;\n      inv.remainingAmount = 0;\n      inv.status = 'free';\n    }\n  }`);
  }

  must(s.includes('FREE_INVOICE_INTEGRITY_V1'), 'free invoice activation guard missing');
  must(s.includes("const freeSubscriber = subscriber.tier === 'free'"), 'free invoice ensure guard missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Cloud boundary integrity. Normalize free subscribers on BOTH pull and push.
//    Also clear a stale collector dirty flag only when the cloud already contains every
//    local subscriber/invoice/audit identity. Genuine offline additions/payments remain
//    protected and are still pushed first.
// -----------------------------------------------------------------------------
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let s = read(p);

  if (!s.includes('LIVE_FINANCE_FREE_NORMALIZER_V1')) {
    const helperAnchor = "function writeLocal(storageKey: string, value: unknown) {\n  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {}\n}";
    must(s.includes(helperAnchor), 'writeLocal helper anchor missing');
    s = s.replace(helperAnchor, `${helperAnchor}\n\n// LIVE_FINANCE_FREE_NORMALIZER_V1\nconst isPermanentFreeSubscriber = (s: Subscriber) => s.tier === 'free' || s.isExempted === true || s.paymentStatus === 'free';\nconst normalizeInvoiceForSubscriber = (s: Subscriber, inv: SubscriberInvoice): SubscriberInvoice =>\n  isPermanentFreeSubscriber(s) && inv.status !== 'cancelled'\n    ? { ...inv, tier: 'free', pricePerAmpere: 0, fixedFee: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, status: 'free' }\n    : inv;`);

    // Final collector guard creates writableSubscribers. Generator admin keeps all rows;
    // collectors keep their restricted population. Normalize invoice money before upsert.
    const finalInvoices = "const invoices = writableSubscribers.flatMap(s => s.invoicesHistory || []);";
    const baseInvoices = "const invoices = subscribers.flatMap(s => s.invoicesHistory || []);";
    if (s.includes(finalInvoices)) {
      s = s.replace(finalInvoices, "const invoices = writableSubscribers.flatMap(sub => (sub.invoicesHistory || []).map(inv => normalizeInvoiceForSubscriber(sub, inv)));");
    } else {
      must(s.includes(baseInvoices), 'push invoice source missing');
      s = s.replace(baseInvoices, "const invoices = subscribers.flatMap(sub => (sub.invoicesHistory || []).map(inv => normalizeInvoiceForSubscriber(sub, inv)));");
    }

    // Tombstone patches may add a .filter(...) before this map, so patch the stable
    // map return rather than requiring the whole writeLocal expression to match exactly.
    const pullReturn = "          return { ...subscriber, invoicesHistory: invoiceMap.get(subscriber.id) || [] };";
    must(s.includes(pullReturn), 'cloud subscriber pull return missing');
    s = s.replace(pullReturn, `          const history = (invoiceMap.get(subscriber.id) || []).map(inv => normalizeInvoiceForSubscriber(subscriber, inv));\n          if (isPermanentFreeSubscriber(subscriber)) {\n            return { ...subscriber, paymentStatus: 'free', amountDue: 0, amountPaid: 0, invoicesHistory: history };\n          }\n          return { ...subscriber, invoicesHistory: history };`);
  }

  // A previous installed collector build may leave moldatk_pending_sync=1 even though all
  // of its rows are already on the server. In that exact case a stale local paid status
  // must not overwrite a newer server unpaid status during bootstrap.
  if (!s.includes('COLLECTOR_STALE_PENDING_RECONCILIATION_V1')) {
    const localAuditAnchor = "        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);";
    must(s.includes(localAuditAnchor), 'local audit pull anchor missing');
    s = s.replace(localAuditAnchor, `${localAuditAnchor}\n\n        // COLLECTOR_STALE_PENDING_RECONCILIATION_V1\n        if (session?.role === 'collector' && hasPendingLocalChanges()) {\n          const remoteSubscriberIds = new Set((subs.data || []).map((row: any) => String(row.id)));\n          const remoteInvoiceIds = new Set((invoices.data || []).map((row: any) => String(row.id)));\n          const remoteAuditIds = new Set((logs.data || []).map((row: any) => String(row.id)));\n          const localInvoiceIds = localSubs.flatMap(sub => (sub.invoicesHistory || []).map(inv => String(inv.id)));\n          const hasLocalOnlyIdentity =\n            localSubs.some(sub => !remoteSubscriberIds.has(String(sub.id))) ||\n            localInvoiceIds.some(id => !remoteInvoiceIds.has(id)) ||\n            localAudit.some(log => !remoteAuditIds.has(String(log.id)));\n          if (!hasLocalOnlyIdentity) clearPendingLocalChanges();\n        }`);
  }

  must(s.includes('LIVE_FINANCE_FREE_NORMALIZER_V1'), 'cloud free normalizer missing');
  must(s.includes('COLLECTOR_STALE_PENDING_RECONCILIATION_V1'), 'collector stale pending reconciliation missing');
  must(s.includes("return { ...subscriber, paymentStatus: 'free', amountDue: 0, amountPaid: 0"), 'free subscriber cloud pull is not zeroed');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Build-breaking final invariants: all interfaces must keep the authoritative paid
//    classifier and the collector must never expose free/exempt rows.
// -----------------------------------------------------------------------------
{
  const accounting = read('src/utils/authoritativeAccounting.ts');
  const pos = read('src/components/POSQuickView.tsx');
  const sync = read('src/lib/useGeneratorCloudSync.ts');
  const monthly = read('src/utils/monthlyAccounting.ts');

  must(accounting.includes("r.status === 'paid' && r.outstanding === 0 && r.bill > 0"), 'authoritative paid classifier missing');
  must(pos.includes('COLLECTOR_OWNER_ACCOUNTING_PARITY_V2'), 'collector-owner accounting parity block missing');
  must(pos.includes('COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2'), 'collector free subscriber filter missing');
  must(sync.includes('LIVE_FINANCE_FREE_NORMALIZER_V1'), 'cloud normalization marker missing');
  must(monthly.includes('FREE_INVOICE_INTEGRITY_V1'), 'monthly free normalization marker missing');
}

console.log('Live finance reconciliation applied: free invoices self-heal, stale collector pending state cannot overwrite newer cloud status, and owner/collector paid counts remain on one classifier.');
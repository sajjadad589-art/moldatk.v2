import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(`Monthly cycle reconciliation: ${message}`); };

// Final production guard for monthly tariff activation.
// 1) A newly activated month must never reuse a paid invoice from an older lifecycle
//    just because both share the same YYYY-MM key.
// 2) After every owner cloud push, the database RPC materializes the authoritative
//    monthly ledger and refreshes local subscriber/invoice projections from Supabase.

{
  const p = 'src/components/PricingModal.tsx';
  let s = read(p);
  s = s.replaceAll("createdAt: new Date().toISOString().split('T')[0],", "createdAt: new Date().toISOString(),");
  write(p, s);
}

{
  const p = 'src/App.tsx';
  let s = read(p);

  const oldLookup = "        const charge = calculateMonthlyCharge(sub, activeRecord!.tiers);\n        let currentInvoice = history.find(inv => inv.monthId === activeRecord!.id && inv.status !== 'cancelled');";
  const newLookup = "        const charge = calculateMonthlyCharge(sub, activeRecord!.tiers);\n        const isFreshCycleActivation = previousActiveId !== activeRecord!.id;\n        const cycleActivationDate = String(activeRecord!.createdAt || nowIso).slice(0, 10);\n        let currentInvoice = history.find(inv =>\n          inv.monthId === activeRecord!.id &&\n          inv.status !== 'cancelled' &&\n          (!isFreshCycleActivation || String(inv.issueDate || '') >= cycleActivationDate)\n        );";
  if (s.includes(oldLookup)) s = s.replace(oldLookup, newLookup);

  const oldId = "            id: 'inv-' + activeRecord!.id + '-' + sub.id,";
  const newId = "            id: (isFreshCycleActivation\n              ? 'cycle-' + activeRecord!.id + '-' + String(activeRecord!.createdAt || nowIso).replace(/\\D/g, '').slice(0, 14) + '-' + sub.id\n              : 'inv-' + activeRecord!.id + '-' + sub.id),";
  if (s.includes(oldId)) s = s.replace(oldId, newId);

  must(s.includes('const isFreshCycleActivation = previousActiveId !== activeRecord!.id;'), 'fresh-cycle collision guard missing from App');
  write(p, s);
}

{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let s = read(p);

  // Preserve the exact local activation timestamp when a tariff row is first materialized.
  // This lets the backend distinguish pre-cycle legacy invoices from real payments made
  // after the new tariff was activated, even if both use the same calendar month id.
  const tariffUpdated = "  is_current_active: Boolean(t.isCurrentActive),\n  updated_at: new Date().toISOString(),";
  if (s.includes(tariffUpdated) && !s.includes("created_at: t.createdAt || new Date().toISOString(),")) {
    s = s.replace(tariffUpdated, "  is_current_active: Boolean(t.isCurrentActive),\n  created_at: t.createdAt || new Date().toISOString(),\n  updated_at: new Date().toISOString(),");
  }

  const marker = "        lastSnapshot.current = snapshot();";
  if (!s.includes('AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1')) {
    must(s.includes(marker), 'cloud-sync completion marker missing');
    const block = `        // AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1\n        // Local state is convenient offline, but monthly debt must be committed by the database.\n        // Reconcile only for the owner/admin role; collector payments remain normal cloud writes.\n        if (session?.role === 'generator_admin') {\n          const activeTariff = tariffs.find(t => t.isCurrentActive) || tariffs[0];\n          if (activeTariff?.id) {\n            const { error: reconcileError } = await supabase.rpc('reconcile_generator_monthly_cycle', {\n              p_generator_id: generatorId,\n              p_tariff_id: activeTariff.id,\n            });\n            if (reconcileError) throw reconcileError;\n\n            // Pull the server-authoritative financial projection immediately so the dashboard\n            // cannot keep stale paid/unpaid counters or zero balances after tariff activation.\n            const [freshSubs, freshInvoices] = await Promise.all([\n              supabase.from('generator_subscribers').select('*').eq('generator_id', generatorId).order('created_at'),\n              supabase.from('generator_invoices').select('*').eq('generator_id', generatorId).order('issue_date', { ascending: false }),\n            ]);\n            if (freshSubs.error) throw freshSubs.error;\n            if (freshInvoices.error) throw freshInvoices.error;\n\n            const freshInvoiceMap = new Map<string, SubscriberInvoice[]>();\n            for (const row of freshInvoices.data || []) {\n              const item = rowToInvoice(row);\n              const list = freshInvoiceMap.get(item.subscriberId) || [];\n              list.push(item);\n              freshInvoiceMap.set(item.subscriberId, list);\n            }\n            writeLocal(localKeys.subscribers, (freshSubs.data || []).map((row: any) => {\n              const subscriber = rowToSubscriber(row);\n              return { ...subscriber, invoicesHistory: freshInvoiceMap.get(subscriber.id) || [] };\n            }));\n          }\n        }\n\n`;
    s = s.replace(marker, block + marker);
  }

  must(s.includes('AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1'), 'cloud reconciliation block missing');
  must(s.includes("supabase.rpc('reconcile_generator_monthly_cycle'"), 'reconcile RPC call missing');
  write(p, s);
}

console.log('Applied authoritative monthly cycle ledger reconciliation, same-month collision guard, and immediate cloud refresh');

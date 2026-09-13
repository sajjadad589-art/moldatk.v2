import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(`Monthly cycle reconciliation: ${message}`); };

// Final production guard for monthly tariff activation.
// The database owns the final monthly ledger; local state is refreshed from Supabase
// immediately after every successful owner/admin cloud push.

{
  const p = 'src/components/PricingModal.tsx';
  let s = read(p);
  s = s.replaceAll("createdAt: new Date().toISOString().split('T')[0],", "createdAt: new Date().toISOString(),");
  write(p, s);
}

{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let s = read(p);

  // Preserve the exact activation timestamp on first materialization. This lets the
  // backend distinguish legacy invoices from payments created after the active cycle.
  const tariffUpdated = "  is_current_active: Boolean(t.isCurrentActive),\n  updated_at: new Date().toISOString(),";
  if (s.includes(tariffUpdated) && !s.includes("created_at: t.createdAt || new Date().toISOString(),")) {
    s = s.replace(tariffUpdated, "  is_current_active: Boolean(t.isCurrentActive),\n  created_at: t.createdAt || new Date().toISOString(),\n  updated_at: new Date().toISOString(),");
  }

  const marker = "        lastSnapshot.current = snapshot();";
  if (!s.includes('AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1')) {
    must(s.includes(marker), 'cloud-sync completion marker missing');
    const block = `        // AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1\n        // Reconcile only for the owner/admin role; collector payments remain normal cloud writes.\n        if (session?.role === 'generator_admin') {\n          const activeTariff = tariffs.find(t => t.isCurrentActive) || tariffs[0];\n          if (activeTariff?.id) {\n            const { error: reconcileError } = await supabase.rpc('reconcile_generator_monthly_cycle', {\n              p_generator_id: generatorId,\n              p_tariff_id: activeTariff.id,\n            });\n            if (reconcileError) throw reconcileError;\n\n            // Pull the server-authoritative financial projection immediately so the dashboard\n            // cannot keep stale paid/unpaid counters or zero balances after tariff activation.\n            const [freshSubs, freshInvoices] = await Promise.all([\n              supabase.from('generator_subscribers').select('*').eq('generator_id', generatorId).order('created_at'),\n              supabase.from('generator_invoices').select('*').eq('generator_id', generatorId).order('issue_date', { ascending: false }),\n            ]);\n            if (freshSubs.error) throw freshSubs.error;\n            if (freshInvoices.error) throw freshInvoices.error;\n\n            const freshInvoiceMap = new Map<string, SubscriberInvoice[]>();\n            for (const row of freshInvoices.data || []) {\n              const item = rowToInvoice(row);\n              const list = freshInvoiceMap.get(item.subscriberId) || [];\n              list.push(item);\n              freshInvoiceMap.set(item.subscriberId, list);\n            }\n            writeLocal(localKeys.subscribers, (freshSubs.data || []).map((row: any) => {\n              const subscriber = rowToSubscriber(row);\n              return { ...subscriber, invoicesHistory: freshInvoiceMap.get(subscriber.id) || [] };\n            }));\n          }\n        }\n\n`;
    s = s.replace(marker, block + marker);
  }

  must(s.includes('AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1'), 'cloud reconciliation block missing');
  must(s.includes("supabase.rpc('reconcile_generator_monthly_cycle'"), 'reconcile RPC call missing');
  write(p, s);
}

console.log('Applied authoritative monthly cycle ledger reconciliation and immediate cloud refresh');

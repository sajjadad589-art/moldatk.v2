import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error(`Financial integrity finalizer: ${msg}`); };

// Tariff deletion is an accounting operation. Never raw-delete the tariff row because
// doing so would leave invoice/monthly-account liabilities behind.
{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);
  const rawDelete = `      await remove('generator_monthly_tariffs', sent.deletedTariffs);`;
  const safeDelete = `      // FINANCIAL_INTEGRITY_TARIFF_DELETE_V2\n      for (const tariffId of sent.deletedTariffs) {\n        const { error } = await client.rpc('delete_generator_tariff_month', {\n          p_generator_id: id,\n          p_tariff_id: tariffId,\n        });\n        if (error) throw error;\n      }`;
  if (s.includes(rawDelete)) s = s.replace(rawDelete, safeDelete);
  must(s.includes("client.rpc('delete_generator_tariff_month'"), 'tariff deletion is not routed through accounting RPC');
  must(!s.includes("remove('generator_monthly_tariffs', sent.deletedTariffs)"), 'raw tariff deletion still exists');
  write(p, s);
}

// Custom payments use application-side validation. Browser number-step validation must
// never reject a valid integer IQD amount (the old 0-1 / step issue).
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);
  if (!s.includes('  activeMonthId?: string;')) {
    s = s.replace('  pricingTiers: SubscriptionTierPricing[];\n', '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n');
  }
  if (!s.includes('  activeMonthId,\n')) {
    s = s.replace('  pricingTiers,\n  collectors,', '  pricingTiers,\n  activeMonthId,\n  collectors,');
  }
  s = s.replace('<form onSubmit={handleApplyPayment} className=', '<form noValidate onSubmit={handleApplyPayment} className=');
  s = s.replace(/step=\{1000\}/g, 'step={1}');
  s = s.replace(/step="1000"/g, 'step="1"');
  s = s.replace('onChange={e => setPartialAmount(Number(e.target.value))}', 'onChange={e => setPartialAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}');
  must(s.includes('<form noValidate onSubmit={handleApplyPayment}'), 'native validation still controls payment submission');
  write(p, s);
}

// Keep active month context available to the POS payment modal.
{
  const p = 'src/components/POSQuickView.tsx';
  let s = read(p);
  const anchor = '          pricingTiers={pricingTiers}\n          collectors={effectiveCollectors}';
  if (!s.includes('activeMonthId={activeMonthId}')) {
    must(s.includes(anchor), 'POS payment modal anchor missing');
    s = s.replace(anchor, '          pricingTiers={pricingTiers}\n          activeMonthId={activeMonthId}\n          collectors={effectiveCollectors}');
  }
  write(p, s);
}

// Owner custom amount input also accepts any integer IQD amount.
{
  const p = 'src/components/SubscriberModal.tsx';
  let s = read(p);
  s = s.replace('<input type="number" min="1" value={customAmount}', '<input type="number" min="1" step="1" value={customAmount}');
  write(p, s);
}

// Make tariff deletion consequences explicit in the UI.
{
  const p = 'src/components/PricingModal.tsx';
  let s = read(p);
  s = s.replace(
    "? 'تحذير: هذه هي التسعيرة النشطة. سيتم إيقاف هذه الدورة الشهرية. سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً. هل تريد المتابعة؟'",
    "? 'تحذير: هذه هي التسعيرة النشطة. حذفها يلغي كل مبلغ غير مسدد ناتج عن هذا الشهر ولا يتم ترحيله لاحقاً. المبالغ المستلمة فعلياً تبقى في السجل. هل تريد المتابعة؟'"
  );
  s = s.replace(
    ": 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + '؟ سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً.';",
    ": 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + '؟ سيتم إلغاء الدين غير المسدد الخاص بهذا الشهر، مع إبقاء التسديدات الفعلية كسجل تاريخي.';"
  );
  write(p, s);
}

// Absolute last pass: all-debt lump settlement, local/cloud tariff-debt cleanup,
// subscriber-delete/reset invariants, type/import normalization, then final visual/type guard.
await import('./apply-production-financial-operations-final.mjs');
await import('./apply-production-financial-type-repair.mjs');
await import('./apply-post-build-integrity-guard.mjs');

console.log('Financial integrity finalizer complete.');

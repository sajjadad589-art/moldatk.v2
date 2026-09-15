import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error(`Financial integrity finalizer: ${msg}`); };

// ---------------------------------------------------------------------------
// 1) Tariff deletion is a financial operation, not a plain table delete.
//    The server RPC removes/neutralizes that month's liabilities and refreshes totals.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);
  const old = `      await remove('generator_monthly_tariffs', sent.deletedTariffs);`;
  const replacement = `      // FINANCIAL_INTEGRITY_TARIFF_DELETE_V1\n      for (const tariffId of sent.deletedTariffs) {\n        const { error } = await client.rpc('delete_generator_tariff_month', {\n          p_generator_id: id,\n          p_tariff_id: tariffId,\n        });\n        if (error) throw error;\n      }`;
  if (s.includes(old)) s = s.replace(old, replacement);
  must(s.includes("client.rpc('delete_generator_tariff_month'"), 'tariff deletion is not routed through accounting RPC');
  must(!s.includes("remove('generator_monthly_tariffs', sent.deletedTariffs)"), 'raw tariff deletion still exists');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 2) Collector custom/lump payment uses the CURRENT invoice as the lump ceiling.
//    HTML validation is advisory only; submit validation is explicit and integer-IQD.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);

  if (!s.includes("from '../utils/monthlyAccounting'")) {
    s = s.replace(
      "import { formatCurrency, formatNumberArabic, calculateSubscriberBill } from '../utils/formatters';",
      "import { formatCurrency, formatNumberArabic, calculateSubscriberBill } from '../utils/formatters';\nimport { getInvoiceRemaining } from '../utils/monthlyAccounting';"
    );
  }
  if (!s.includes('  activeMonthId?: string;')) {
    s = s.replace('  pricingTiers: SubscriptionTierPricing[];\n', '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n');
  }
  if (!s.includes('  activeMonthId,\n')) {
    s = s.replace('  pricingTiers,\n  collectors,', '  pricingTiers,\n  activeMonthId,\n  collectors,');
  }

  const tierAnchor = "  const currentTier = pricingTiers.find(p => p.type === subscriber.tier);";
  if (!s.includes('const lumpMaximum =')) {
    must(s.includes(tierAnchor), 'payment tier anchor missing');
    s = s.replace(tierAnchor, `${tierAnchor}\n  const activeInvoice = (subscriber.invoicesHistory || [])\n    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && (!activeMonthId || inv.monthId === activeMonthId))\n    .sort((a, b) => String(b.paymentDate || b.issueDate || b.id).localeCompare(String(a.paymentDate || a.issueDate || a.id)))[0];\n  const currentInvoiceRemaining = activeInvoice ? getInvoiceRemaining(activeInvoice) : Math.max(0, calc.total);\n  const lumpMaximum = Math.max(0, currentInvoiceRemaining);`);
  }

  s = s.replace(
    `  } else if (selectedMethod === 'lump') {\n    computedAmountPaid = Math.min(totalAmountDue, Math.max(0, Number(partialAmount) || 0));\n    computedRemaining = 0;`,
    `  } else if (selectedMethod === 'lump') {\n    computedAmountPaid = Math.min(lumpMaximum, Math.max(0, Math.round(Number(partialAmount) || 0)));\n    computedRemaining = Math.max(0, totalAmountDue - computedAmountPaid);`
  );
  s = s.replace("      setPartialAmount(totalAmountDue);\n    } else {", "      setPartialAmount(lumpMaximum);\n    } else {");

  const submitGuard = `    if ((selectedMethod === 'partial' || selectedMethod === 'lump') && computedAmountPaid <= 0) return;`;
  if (s.includes(submitGuard)) {
    s = s.replace(submitGuard, `    if (selectedMethod === 'partial' || selectedMethod === 'lump') {\n      const requested = Math.round(Number(partialAmount) || 0);\n      const maxAllowed = selectedMethod === 'lump' ? lumpMaximum : totalAmountDue;\n      if (!Number.isFinite(requested) || requested < 1 || requested > maxAllowed) {\n        window.alert('أدخل مبلغاً صحيحاً بين 1 و ' + Math.max(0, maxAllowed).toLocaleString('en-US') + ' ' + currency);\n        return;\n      }\n    }`);
  }

  s = s.replace('<form onSubmit={handleApplyPayment} className=', '<form noValidate onSubmit={handleApplyPayment} className=');
  s = s.replace('                  max={totalAmountDue}\n                  step={1000}', "                  max={selectedMethod === 'lump' ? lumpMaximum : totalAmountDue}\n                  step={1}");
  s = s.replace('                  onChange={e => setPartialAmount(Number(e.target.value))}', '                  onChange={e => setPartialAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}');
  s = s.replace(
    '<span className="text-[11px] font-bold text-slate-500">المستحق {formatCurrency(totalAmountDue, currency)}</span>',
    '<span className="text-[11px] font-bold text-slate-500">الحد الأعلى {formatCurrency(selectedMethod === \'lump\' ? lumpMaximum : totalAmountDue, currency)}</span>'
  );

  must(s.includes('step={1}'), 'custom payment must accept any integer IQD amount');
  must(s.includes("max={selectedMethod === 'lump' ? lumpMaximum : totalAmountDue}"), 'lump payment max is not current invoice balance');
  must(s.includes('<form noValidate onSubmit={handleApplyPayment}'), 'native browser validation can still block valid payments');
  must(s.includes('const maxAllowed = selectedMethod === \'lump\' ? lumpMaximum : totalAmountDue;'), 'explicit payment bounds validation missing');
  write(p, s);
}

// Pass the active tariff/month to the collector payment modal so the lump ceiling is exact.
{
  const p = 'src/components/POSQuickView.tsx';
  let s = read(p);
  const anchor = '          pricingTiers={pricingTiers}\n          collectors={effectiveCollectors}';
  if (!s.includes('activeMonthId={activeMonthId}')) {
    must(s.includes(anchor), 'POS payment modal anchor missing');
    s = s.replace(anchor, '          pricingTiers={pricingTiers}\n          activeMonthId={activeMonthId}\n          collectors={effectiveCollectors}');
  }
  must(s.includes('activeMonthId={activeMonthId}'), 'active month is not passed to payment modal');
  write(p, s);
}

// Owner-side lump field: integer IQD and the same current-month ceiling.
{
  const p = 'src/components/SubscriberModal.tsx';
  let s = read(p);
  s = s.replace(
    '<input type="number" min="1" value={customAmount}',
    '<input type="number" min="1" step="1" max={customPaymentMode === \'lump\' ? settlementCurrentRemaining : outstanding} value={customAmount}'
  );
  must(s.includes("max={customPaymentMode === 'lump' ? settlementCurrentRemaining : outstanding}"), 'owner lump ceiling missing');
  write(p, s);
}

// Make tariff deletion copy explicit: debt created by the deleted month is extinguished,
// while money already received remains historical/auditable.
{
  const p = 'src/components/PricingModal.tsx';
  let s = read(p);
  s = s.replace(
    "? 'تحذير: هذه هي التسعيرة النشطة. سيتم إيقاف هذه الدورة الشهرية. سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً. هل تريد المتابعة؟'",
    "? 'تحذير: هذه هي التسعيرة النشطة. حذفها يلغي كل مبلغ غير مسدد ناتج عن هذا الشهر ولا يتم ترحيله لاحقاً. المبالغ التي تم استلامها فعلياً تبقى محفوظة في السجل. هل تريد المتابعة؟'"
  );
  s = s.replace(
    ": 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + '؟ سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً.';",
    ": 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + '؟ سيتم إلغاء الدين غير المسدد الخاص بهذا الشهر فقط، مع إبقاء التسديدات الفعلية محفوظة في السجل.';"
  );
  write(p, s);
}

console.log('Financial integrity guard installed: tariff-debt deletion + exact lump payment bounds.');

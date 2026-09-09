import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Ampere discount finalizer: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Types: recurring subscriber discount + immutable invoice discount snapshot.
// -----------------------------------------------------------------------------
{
  const p = 'src/types.ts';
  let s = read(p);

  if (!s.includes('  originalAmperes?: number;')) {
    s = s.replace(
      '  amperes: number;\n  tier: SubscriptionTierType;\n',
      '  amperes: number;\n  /** Physical/original subscribed amperes at invoice issue time. */\n  originalAmperes?: number;\n  /** Recurring ampere discount snapshot for this invoice. */\n  discountedAmperes?: number;\n  /** Financial amperes actually billed after discount. */\n  billedAmperes?: number;\n  /** Invoice value before the ampere discount. */\n  grossAmountBeforeDiscount?: number;\n  /** Financial value removed by the recurring ampere discount. */\n  discountAmount?: number;\n  tier: SubscriptionTierType;\n'
    );
  }

  if (!s.includes('  ampereDiscount?: number;')) {
    const subscriberAnchor = '  amperes: number;\n  lineId?: string;';
    must(s.includes(subscriberAnchor), 'Subscriber amperes anchor missing');
    s = s.replace(
      subscriberAnchor,
      '  amperes: number;\n  /** Recurring monthly discount in amperes. Physical load remains unchanged. */\n  ampereDiscount?: number;\n  /** Optional owner note explaining the recurring ampere discount. */\n  ampereDiscountReason?: string;\n  lineId?: string;'
    );
  }

  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Monthly accounting: one charge function owns physical, discounted, and billed amps.
// -----------------------------------------------------------------------------
{
  const p = 'src/utils/monthlyAccounting.ts';
  let s = read(p);

  if (!s.includes('AMPERE_DISCOUNT_MONTHLY_ACCOUNTING_V1')) {
    const start = s.indexOf('export function calculateMonthlyCharge(');
    const end = s.indexOf('\n\nexport function getInvoiceRemaining', start);
    must(start >= 0 && end > start, 'calculateMonthlyCharge bounds missing');

    const replacement = `// AMPERE_DISCOUNT_MONTHLY_ACCOUNTING_V1
export interface MonthlyChargeBreakdown {
  total: number;
  pricePerAmpere: number;
  fixedFee: number;
  originalAmperes: number;
  discountedAmperes: number;
  billedAmperes: number;
  grossTotal: number;
  discountAmount: number;
}

export function getSubscriberAmpereDiscount(subscriber: Subscriber): number {
  const original = Math.max(0, Number(subscriber.amperes || 0));
  const requested = Math.max(0, Number(subscriber.ampereDiscount || 0));
  return Math.min(original, requested);
}

export function getSubscriberBillableAmperes(subscriber: Subscriber): number {
  return Math.max(0, Math.max(0, Number(subscriber.amperes || 0)) - getSubscriberAmpereDiscount(subscriber));
}

export function calculateMonthlyCharge(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
): MonthlyChargeBreakdown {
  const originalAmperes = Math.max(0, Number(subscriber.amperes || 0));

  if (subscriber.tier === 'free' || subscriber.isExempted) {
    return {
      total: 0,
      pricePerAmpere: 0,
      fixedFee: 0,
      originalAmperes,
      discountedAmperes: 0,
      billedAmperes: 0,
      grossTotal: 0,
      discountAmount: 0,
    };
  }

  const tier = pricingTiers.find(t => t.type === subscriber.tier || t.id === subscriber.tier);
  const pricePerAmpere = Math.max(0, Number(tier?.pricePerAmpere || 0));
  const fixedFee = Math.max(0, Number(tier?.fixedFee || 0));
  const discountedAmperes = getSubscriberAmpereDiscount(subscriber);
  const billedAmperes = Math.max(0, originalAmperes - discountedAmperes);
  const grossTotal = Math.max(0, originalAmperes * pricePerAmpere + fixedFee);
  const discountAmount = Math.max(0, discountedAmperes * pricePerAmpere);
  const total = Math.max(0, billedAmperes * pricePerAmpere + fixedFee);

  return {
    total,
    pricePerAmpere,
    fixedFee,
    originalAmperes,
    discountedAmperes,
    billedAmperes,
    grossTotal,
    discountAmount,
  };
}`;

    s = s.slice(0, start) + replacement + s.slice(end);
  }

  // Previous-month backfill snapshot.
  s = s.replace(
    '        amperes: sub.amperes,\n        tier: sub.tier,\n        pricePerAmpere: previousCharge.pricePerAmpere,',
    '        amperes: sub.amperes,\n        originalAmperes: previousCharge.originalAmperes,\n        discountedAmperes: previousCharge.discountedAmperes,\n        billedAmperes: previousCharge.billedAmperes,\n        grossAmountBeforeDiscount: previousCharge.grossTotal,\n        discountAmount: previousCharge.discountAmount,\n        tier: sub.tier,\n        pricePerAmpere: previousCharge.pricePerAmpere,'
  );

  // Active-month creation snapshot.
  s = s.replace(
    '        amperes: sub.amperes,\n        tier: sub.tier,\n        pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,',
    '        amperes: sub.amperes,\n        originalAmperes: charge.originalAmperes,\n        discountedAmperes: isFree ? 0 : charge.discountedAmperes,\n        billedAmperes: isFree ? 0 : charge.billedAmperes,\n        grossAmountBeforeDiscount: isFree ? 0 : charge.grossTotal,\n        discountAmount: isFree ? 0 : charge.discountAmount,\n        tier: sub.tier,\n        pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,'
  );

  // Active-month repricing snapshot.
  s = s.replace(
    '      currentInvoice.amperes = sub.amperes;\n      currentInvoice.tier = sub.tier;',
    '      currentInvoice.amperes = sub.amperes;\n      currentInvoice.originalAmperes = charge.originalAmperes;\n      currentInvoice.discountedAmperes = isFree ? 0 : charge.discountedAmperes;\n      currentInvoice.billedAmperes = isFree ? 0 : charge.billedAmperes;\n      currentInvoice.grossAmountBeforeDiscount = isFree ? 0 : charge.grossTotal;\n      currentInvoice.discountAmount = isFree ? 0 : charge.discountAmount;\n      currentInvoice.tier = sub.tier;'
  );

  // ensureMonthInvoice creation snapshot.
  s = s.replace(
    '      amperes: subscriber.amperes,\n      tier: subscriber.tier,\n      pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,',
    '      amperes: subscriber.amperes,\n      originalAmperes: charge.originalAmperes,\n      discountedAmperes: isFree ? 0 : charge.discountedAmperes,\n      billedAmperes: isFree ? 0 : charge.billedAmperes,\n      grossAmountBeforeDiscount: isFree ? 0 : charge.grossTotal,\n      discountAmount: isFree ? 0 : charge.discountAmount,\n      tier: subscriber.tier,\n      pricePerAmpere: isFree ? 0 : charge.pricePerAmpere,'
  );

  // A 100% ampere discount is a zero charge, not an unpaid debt.
  s = s.replace(
    "        status: isFree ? 'free' : 'unpaid',",
    "        status: isFree ? 'free' : charge.total <= 0 ? 'paid' : 'unpaid',"
  );
  s = s.replace(
    "      status: isFree ? 'free' : 'unpaid',",
    "      status: isFree ? 'free' : charge.total <= 0 ? 'paid' : 'unpaid',"
  );

  must(s.includes('AMPERE_DISCOUNT_MONTHLY_ACCOUNTING_V1'), 'monthly accounting marker missing');
  must(s.includes('discountAmount: previousCharge.discountAmount'), 'previous-month discount snapshot missing');
  must(s.includes('discountAmount: isFree ? 0 : charge.discountAmount'), 'active-month discount snapshot missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Subscriber modal: owner-controlled recurring ampere discount.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/SubscriberModal.tsx';
  let s = read(p);

  if (!s.includes('AMPERE_DISCOUNT_SUBSCRIBER_UI_V1')) {
    const customState = "  const [customError, setCustomError] = useState('');";
    must(s.includes(customState), 'custom state anchor missing');
    s = s.replace(
      customState,
      `${customState}
  // AMPERE_DISCOUNT_SUBSCRIBER_UI_V1
  const [ampereDiscount, setAmpereDiscount] = useState<number>(0);
  const [ampereDiscountReason, setAmpereDiscountReason] = useState('');`
    );

    const editAmp = '      setAmperes(subscriberToEdit.amperes || 5);';
    must(s.includes(editAmp), 'edit amperes initializer missing');
    s = s.replace(
      editAmp,
      `${editAmp}
      setAmpereDiscount(Math.max(0, Number(subscriberToEdit.ampereDiscount || 0)));
      setAmpereDiscountReason(subscriberToEdit.ampereDiscountReason || '');`
    );

    const newAmp = '      setAmperes(5);';
    must(s.includes(newAmp), 'new amperes initializer missing');
    s = s.replace(
      newAmp,
      `${newAmp}
      setAmpereDiscount(0);
      setAmpereDiscountReason('');`
    );

    const calcStart = s.indexOf('  const currentCalc = useMemo(() => {');
    const calcEndMarker = '  }, [amperes, currentTierObj]);';
    const calcEnd = s.indexOf(calcEndMarker, calcStart);
    must(calcStart >= 0 && calcEnd > calcStart, 'currentCalc bounds missing');
    const afterCalc = calcEnd + calcEndMarker.length;
    const discountCalc = `  const normalizedAmpereDiscount = useMemo(
    () => Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(ampereDiscount) || 0)),
    [amperes, ampereDiscount]
  );

  const currentCalc = useMemo(() => {
    const pricePerAmpere = Math.max(0, Number(currentTierObj?.pricePerAmpere || 0));
    const fixedFee = Math.max(0, Number(currentTierObj?.fixedFee || 0));
    const originalAmperes = Math.max(0, Number(amperes) || 0);
    const discountedAmperes = currentTierObj?.type === 'free' ? 0 : normalizedAmpereDiscount;
    const billedAmperes = currentTierObj?.type === 'free' ? 0 : Math.max(0, originalAmperes - discountedAmperes);
    const grossTotal = currentTierObj?.type === 'free' ? 0 : Math.max(0, originalAmperes * pricePerAmpere + fixedFee);
    const discountAmount = currentTierObj?.type === 'free' ? 0 : Math.max(0, discountedAmperes * pricePerAmpere);
    return {
      pricePerAmpere,
      fixedFee,
      originalAmperes,
      discountedAmperes,
      billedAmperes,
      grossTotal,
      discountAmount,
      total: currentTierObj?.type === 'free' ? 0 : Math.max(0, billedAmperes * pricePerAmpere + fixedFee),
    };
  }, [amperes, normalizedAmpereDiscount, currentTierObj]);`;
    s = s.slice(0, calcStart) + discountCalc + s.slice(afterCalc);

    // Historical onboarding debt must use the exact selected month's tariff and the same recurring ampere discount.
    s = s.replace(
      '    return Math.max(0, (Number(amperes) || 0) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));',
      '    const original = Math.max(0, Number(amperes) || 0);\\n    const discounted = Math.min(original, Math.max(0, Number(ampereDiscount) || 0));\\n    return Math.max(0, (original - discounted) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));'
    );
    s = s.replace(
      '  }, [amperes, selectedPriorTier]);',
      '  }, [amperes, ampereDiscount, selectedPriorTier]);'
    );

    const selectedTierLine = "    const selectedTierType = (currentTierObj?.type || tier) as Subscriber['tier'];";
    must(s.includes(selectedTierLine), 'selected tier submit anchor missing');
    s = s.replace(
      selectedTierLine,
      `${selectedTierLine}
    const effectiveAmpereDiscount = selectedTierType === 'free'
      ? 0
      : Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(ampereDiscount) || 0));
    const effectiveDiscountReason = effectiveAmpereDiscount > 0 ? ampereDiscountReason.trim() : '';`
    );

    // Persist discount on both new and existing subscribers.
    s = s.replace(
      '        amperes,\n        tier: selectedTierType,',
      '        amperes,\n        ampereDiscount: effectiveAmpereDiscount,\n        ampereDiscountReason: effectiveDiscountReason || undefined,\n        tier: selectedTierType,'
    );
    s = s.replace(
      '      amperes,\n      tier: selectedTierType,\n      lineId:',
      '      amperes,\n      ampereDiscount: effectiveAmpereDiscount,\n      ampereDiscountReason: effectiveDiscountReason || undefined,\n      tier: selectedTierType,\n      lineId:'
    );

    // Audit discount changes.
    const changeAnchor = "    if (subscriberToEdit.amperes !== amperes) changes.push('الأمبيرات: من (' + subscriberToEdit.amperes + ') إلى (' + amperes + ')');";
    must(s.includes(changeAnchor), 'edit audit anchor missing');
    s = s.replace(
      changeAnchor,
      `${changeAnchor}
    if (Number(subscriberToEdit.ampereDiscount || 0) !== effectiveAmpereDiscount) changes.push('خصم الأمبيرات: من (' + Number(subscriberToEdit.ampereDiscount || 0) + ') إلى (' + effectiveAmpereDiscount + ')');`
    );

    // Current unpaid invoice gets the discount snapshot. Paid/settled invoices stay immutable.
    s = s.replace(
      '      current.amperes = amperes;\n      current.tier = selectedTierType;',
      `      current.amperes = amperes;
      current.originalAmperes = currentCalc.originalAmperes;
      current.discountedAmperes = currentCalc.discountedAmperes;
      current.billedAmperes = currentCalc.billedAmperes;
      current.grossAmountBeforeDiscount = currentCalc.grossTotal;
      current.discountAmount = currentCalc.discountAmount;
      current.tier = selectedTierType;`
    );

    // Onboarding debt amount uses discounted billed amperes.
    s = s.replace(
      '      const debt = Math.max(0, (Number(amperes) || 0) * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));',
      `      const priorOriginalAmperes = Math.max(0, Number(amperes) || 0);
      const priorDiscountedAmperes = Math.min(priorOriginalAmperes, effectiveAmpereDiscount);
      const priorBilledAmperes = Math.max(0, priorOriginalAmperes - priorDiscountedAmperes);
      const priorGrossAmount = Math.max(0, priorOriginalAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));
      const priorDiscountAmount = Math.max(0, priorDiscountedAmperes * Number(tariffTier.pricePerAmpere || 0));
      const debt = Math.max(0, priorBilledAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));`
    );

    // Attach immutable discount snapshot to historical onboarding debt.
    s = s.replace(
      '        amperes,\n        tier: selectedTierType,\n        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),',
      `        amperes,
        originalAmperes: priorOriginalAmperes,
        discountedAmperes: priorDiscountedAmperes,
        billedAmperes: priorBilledAmperes,
        grossAmountBeforeDiscount: priorGrossAmount,
        discountAmount: priorDiscountAmount,
        tier: selectedTierType,
        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),`
    );

    // New-subscriber profile UI card. It lives before the onboarding-debt choice.
    const onboardingMarker = "{!subscriberToEdit && currentTierObj?.type !== 'free' && (";
    must(s.includes(onboardingMarker), 'onboarding UI marker missing');
    const discountUi = `{currentTierObj?.type !== 'free' && (
              <div data-ampere-discount-editor-v1 className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-xs font-black text-slate-900 dark:text-white">خصم الأمبيرات الشهري</h3><p className="text-[10px] text-slate-500 mt-1">يبقى فعالاً تلقائياً مع كل تسعيرة شهرية جديدة إلى أن تعدله أو تصفره.</p></div>
                  <span className="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">{currentCalc.billedAmperes}A محتسب</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">الأمبيرات المخصومة</label><input type="number" min="0" max={Math.max(0, Number(amperes) || 0)} step="0.5" value={ampereDiscount} onChange={e => setAmpereDiscount(Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(e.target.value) || 0)))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500" dir="ltr" /></div>
                  <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">سبب الخصم (اختياري)</label><input value={ampereDiscountReason} onChange={e => setAmpereDiscountReason(e.target.value)} placeholder="مثال: اتفاق خاص" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500" /></div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
                  <div><span className="block text-[9px] font-bold text-slate-400">الأصلي</span><strong className="text-xs text-slate-900 dark:text-white">{currentCalc.originalAmperes}A</strong></div>
                  <div><span className="block text-[9px] font-bold text-slate-400">الخصم</span><strong className="text-xs text-amber-600">{currentCalc.discountedAmperes}A</strong></div>
                  <div><span className="block text-[9px] font-bold text-slate-400">قيمة الخصم</span><strong className="text-xs text-emerald-600">{formatCurrency(currentCalc.discountAmount)}</strong></div>
                </div>
              </div>
            )}
            `;
    s = s.replace(onboardingMarker, discountUi + onboardingMarker);

    // Profile shows physical amps and the financial billed amps without changing technical load.
    const detailAmp = '<DetailRow label="عدد الأمبيرات" value={`${formatNum(subscriberToEdit.amperes)} أمبير`} strong />';
    must(s.includes(detailAmp), 'subscriber profile amperes row missing');
    s = s.replace(
      detailAmp,
      `${detailAmp}
              {Number(subscriberToEdit.ampereDiscount || 0) > 0 && <DetailRow label="خصم الأمبيرات" value={\`\${formatNum(subscriberToEdit.ampereDiscount)} أمبير\`} strong />}
              {Number(subscriberToEdit.ampereDiscount || 0) > 0 && <DetailRow label="الأمبيرات المحتسبة للجباية" value={\`\${formatNum(Math.max(0, Number(subscriberToEdit.amperes || 0) - Number(subscriberToEdit.ampereDiscount || 0)))} أمبير\`} strong />}
              {subscriberToEdit.ampereDiscountReason && <DetailRow label="سبب الخصم" value={subscriberToEdit.ampereDiscountReason} />}`
    );
  }

  must(s.includes('data-ampere-discount-editor-v1'), 'discount editor missing');
  must(s.includes('ampereDiscount: effectiveAmpereDiscount'), 'discount persistence missing');
  must(s.includes('current.discountAmount = currentCalc.discountAmount'), 'current invoice discount snapshot missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 4) Cloud sync: persist subscriber recurring discount + invoice snapshot fields.
// -----------------------------------------------------------------------------
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let s = read(p);

  if (!s.includes('AMPERE_DISCOUNT_CLOUD_SYNC_V1')) {
    const rowAnchor = '  amperes: Number(s.amperes || 0),';
    must(s.includes(rowAnchor), 'subscriberToRow amperes anchor missing');
    s = s.replace(
      rowAnchor,
      `${rowAnchor}
  // AMPERE_DISCOUNT_CLOUD_SYNC_V1
  ampere_discount: Number(s.ampereDiscount || 0),
  ampere_discount_reason: s.ampereDiscountReason || null,`
    );

    const subReadAnchor = '  amperes: Number(r.amperes || 0),';
    must(s.includes(subReadAnchor), 'rowToSubscriber amperes anchor missing');
    s = s.replace(
      subReadAnchor,
      `${subReadAnchor}
  ampereDiscount: Math.max(0, Number(r.ampere_discount || 0)),
  ampereDiscountReason: r.ampere_discount_reason || undefined,`
    );

    const invWriteAnchor = '  amperes: Number(i.amperes || 0),';
    must(s.includes(invWriteAnchor), 'invoiceToRow amperes anchor missing');
    s = s.replace(
      invWriteAnchor,
      `${invWriteAnchor}
  original_amperes: i.originalAmperes == null ? null : Number(i.originalAmperes),
  discounted_amperes: i.discountedAmperes == null ? null : Number(i.discountedAmperes),
  billed_amperes: i.billedAmperes == null ? null : Number(i.billedAmperes),
  gross_amount_before_discount: i.grossAmountBeforeDiscount == null ? null : Number(i.grossAmountBeforeDiscount),
  discount_amount: i.discountAmount == null ? null : Number(i.discountAmount),`
    );

    const invReadAnchor = '  amperes: Number(r.amperes || 0),';
    const invReadIndex = s.indexOf('const rowToInvoice');
    must(invReadIndex >= 0, 'rowToInvoice missing');
    const anchorIndex = s.indexOf(invReadAnchor, invReadIndex);
    must(anchorIndex >= 0, 'rowToInvoice amperes anchor missing');
    s = s.slice(0, anchorIndex) + s.slice(anchorIndex).replace(
      invReadAnchor,
      `${invReadAnchor}
  originalAmperes: r.original_amperes == null ? undefined : Number(r.original_amperes),
  discountedAmperes: r.discounted_amperes == null ? undefined : Number(r.discounted_amperes),
  billedAmperes: r.billed_amperes == null ? undefined : Number(r.billed_amperes),
  grossAmountBeforeDiscount: r.gross_amount_before_discount == null ? undefined : Number(r.gross_amount_before_discount),
  discountAmount: r.discount_amount == null ? undefined : Number(r.discount_amount),`
    );
  }

  must(s.includes('ampere_discount: Number(s.ampereDiscount || 0)'), 'subscriber discount cloud write missing');
  must(s.includes('discount_amount: i.discountAmount'), 'invoice discount cloud write missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 5) Authoritative finance: tariff fallback must use discounted monthly charge.
// -----------------------------------------------------------------------------
{
  const p = 'src/utils/authoritativeAccounting.ts';
  let s = read(p);

  s = s.replace("import { calculateSubscriberBill } from './formatters';\n", '');
  s = s.replace(
    "import { getInvoiceRemaining, getMonthId } from './monthlyAccounting';",
    "import { calculateMonthlyCharge, getInvoiceRemaining, getMonthId } from './monthlyAccounting';"
  );
  s = s.replace(
    '  const tariffBill = n(calculateSubscriberBill(sub.amperes, sub.tier, tiers).total);',
    '  const tariffBill = n(calculateMonthlyCharge(sub, tiers).total);'
  );

  must(s.includes('calculateMonthlyCharge(sub, tiers).total'), 'authoritative discounted tariff fallback missing');
  write(p, s);
}

console.log('Recurring ampere discount applied: persistent owner setting, monthly auto-billing, invoice snapshots, cloud sync and authoritative totals are aligned.');

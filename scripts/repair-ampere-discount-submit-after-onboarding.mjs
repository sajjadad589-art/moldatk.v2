import fs from 'node:fs';

const path = 'src/components/SubscriberModal.tsx';
const read = () => fs.readFileSync(path, 'utf8');
const write = source => fs.writeFileSync(path, source, 'utf8');
const must = (value, message) => { if (!value) throw new Error(`Ampere discount submit repair: ${message}`); };

let source = read();

// The onboarding/lump finalizer intentionally rewrites handleSubmit on every lint/build pass.
// On the first pass the recurring-ampere finalizer has not run yet, so there is nothing to
// repair. On later passes the UI/state marker remains while the rewritten submit handler has
// lost the recurring discount fields. Repair only that handler before its final assertions run.
if (!source.includes('AMPERE_DISCOUNT_SUBSCRIBER_UI_V1')) {
  console.log('Ampere discount submit repair skipped until recurring UI is first installed.');
} else {
  must(source.includes('const [ampereDiscount, setAmpereDiscount]'), 'discount state missing');
  must(source.includes('currentCalc.discountAmount') || source.includes('discountAmount,'), 'discount calculation missing');

  const replaceAfter = (marker, target, replacement, label) => {
    const markerIndex = source.indexOf(marker);
    must(markerIndex >= 0, `${label} marker missing`);
    const targetIndex = source.indexOf(target, markerIndex);
    must(targetIndex >= 0, `${label} target missing`);
    source = source.slice(0, targetIndex) + replacement + source.slice(targetIndex + target.length);
  };

  const selectedTierLine = "    const selectedTierType = (currentTierObj?.type || tier) as Subscriber['tier'];";
  if (!source.includes('    const effectiveAmpereDiscount = selectedTierType === \'free\'')) {
    must(source.includes(selectedTierLine), 'selected tier line missing');
    source = source.replace(
      selectedTierLine,
      `${selectedTierLine}\n    const effectiveAmpereDiscount = selectedTierType === 'free'\n      ? 0\n      : Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(ampereDiscount) || 0));\n    const effectiveDiscountReason = effectiveAmpereDiscount > 0 ? ampereDiscountReason.trim() : '';`
    );
  }

  // New subscriber base: recurring discount must survive zero-debt onboarding too.
  const baseStart = source.indexOf('      const base: Subscriber = {');
  const baseEnd = baseStart >= 0 ? source.indexOf('      };', baseStart) : -1;
  must(baseStart >= 0 && baseEnd > baseStart, 'new subscriber base bounds missing');
  const baseSegment = source.slice(baseStart, baseEnd);
  if (!baseSegment.includes('ampereDiscount: effectiveAmpereDiscount')) {
    replaceAfter(
      '      const base: Subscriber = {',
      '        amperes,\n        tier: selectedTierType,',
      '        amperes,\n        ampereDiscount: effectiveAmpereDiscount,\n        ampereDiscountReason: effectiveDiscountReason || undefined,\n        tier: selectedTierType,',
      'new subscriber discount persistence'
    );
  }

  // Historical onboarding debt uses the discounted billed amperes and stores an immutable snapshot.
  if (!source.includes('      const priorDiscountedAmperes = Math.min(priorOriginalAmperes, effectiveAmpereDiscount);')) {
    const debtLine = '      const debt = Math.max(0, (Number(amperes) || 0) * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));';
    must(source.includes(debtLine), 'historical debt calculation anchor missing');
    source = source.replace(
      debtLine,
      `      const priorOriginalAmperes = Math.max(0, Number(amperes) || 0);\n      const priorDiscountedAmperes = Math.min(priorOriginalAmperes, effectiveAmpereDiscount);\n      const priorBilledAmperes = Math.max(0, priorOriginalAmperes - priorDiscountedAmperes);\n      const priorGrossAmount = Math.max(0, priorOriginalAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));\n      const priorDiscountAmount = Math.max(0, priorDiscountedAmperes * Number(tariffTier.pricePerAmpere || 0));\n      const debt = Math.max(0, priorBilledAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));`
    );
  }

  const debtInvoiceStart = source.indexOf('      const debtInvoice: SubscriberInvoice = {');
  const debtInvoiceEnd = debtInvoiceStart >= 0 ? source.indexOf('      };', debtInvoiceStart) : -1;
  must(debtInvoiceStart >= 0 && debtInvoiceEnd > debtInvoiceStart, 'historical debt invoice bounds missing');
  const debtInvoiceSegment = source.slice(debtInvoiceStart, debtInvoiceEnd);
  if (!debtInvoiceSegment.includes('discountAmount: priorDiscountAmount')) {
    replaceAfter(
      '      const debtInvoice: SubscriberInvoice = {',
      '        amperes,\n        tier: selectedTierType,\n        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),',
      '        amperes,\n        originalAmperes: priorOriginalAmperes,\n        discountedAmperes: priorDiscountedAmperes,\n        billedAmperes: priorBilledAmperes,\n        grossAmountBeforeDiscount: priorGrossAmount,\n        discountAmount: priorDiscountAmount,\n        tier: selectedTierType,\n        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),',
      'historical debt discount snapshot'
    );
  }

  // Existing subscriber edit: persist the recurring discount and audit the change.
  const draftStart = source.indexOf('    const draft: Subscriber = {');
  const draftEnd = draftStart >= 0 ? source.indexOf('    };', draftStart) : -1;
  must(draftStart >= 0 && draftEnd > draftStart, 'existing subscriber draft bounds missing');
  const draftSegment = source.slice(draftStart, draftEnd);
  if (!draftSegment.includes('ampereDiscount: effectiveAmpereDiscount')) {
    replaceAfter(
      '    const draft: Subscriber = {',
      '      amperes,\n      tier: selectedTierType,\n      lineId:',
      '      amperes,\n      ampereDiscount: effectiveAmpereDiscount,\n      ampereDiscountReason: effectiveDiscountReason || undefined,\n      tier: selectedTierType,\n      lineId:',
      'existing subscriber discount persistence'
    );
  }

  const auditAnchor = "    if (subscriberToEdit.amperes !== amperes) changes.push('الأمبيرات: من (' + subscriberToEdit.amperes + ') إلى (' + amperes + ')');";
  if (!source.includes("changes.push('خصم الأمبيرات:")) {
    must(source.includes(auditAnchor), 'discount audit anchor missing');
    source = source.replace(
      auditAnchor,
      `${auditAnchor}\n    if (Number(subscriberToEdit.ampereDiscount || 0) !== effectiveAmpereDiscount) changes.push('خصم الأمبيرات: من (' + Number(subscriberToEdit.ampereDiscount || 0) + ') إلى (' + effectiveAmpereDiscount + ')');`
    );
  }

  if (!source.includes('      current.discountAmount = currentCalc.discountAmount;')) {
    const currentAnchor = '      current.amperes = amperes;\n      current.tier = selectedTierType;';
    must(source.includes(currentAnchor), 'current invoice repricing anchor missing');
    source = source.replace(
      currentAnchor,
      `      current.amperes = amperes;\n      current.originalAmperes = currentCalc.originalAmperes;\n      current.discountedAmperes = currentCalc.discountedAmperes;\n      current.billedAmperes = currentCalc.billedAmperes;\n      current.grossAmountBeforeDiscount = currentCalc.grossTotal;\n      current.discountAmount = currentCalc.discountAmount;\n      current.tier = selectedTierType;`
    );
  }

  must(source.includes('ampereDiscount: effectiveAmpereDiscount'), 'discount persistence still missing');
  must(source.includes('discountAmount: priorDiscountAmount'), 'historical debt discount snapshot still missing');
  must(source.includes('current.discountAmount = currentCalc.discountAmount'), 'current invoice discount snapshot still missing');
  write(source);
  console.log('Recurring ampere discount submit handler repaired after onboarding rewrite.');
}

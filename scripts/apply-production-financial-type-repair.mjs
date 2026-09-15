import fs from 'node:fs';

const text = p => fs.readFileSync(p, 'utf8');
const save = (p, s) => fs.writeFileSync(p, s, 'utf8');

{
  const p = 'src/components/SubscriberModal.tsx';
  let s = text(p);
  if (s.includes('settlementMode,\n          customAmount,')) {
    s = s.replace('settlementMode,\n          customAmount,', 'settlementMode,\n          paymentAmount: customAmount,');
  }
  for (const anchor of [
    'customAmount > totalSubscriberDebt',
    'const updated = settleAllSubscriberDebt',
    'remainingSubscriberDebt: Math.max(0, totalSubscriberDebt - customAmount)',
  ]) {
    if (!s.includes(anchor)) console.warn(`Financial type repair: subscriber marker missing (${anchor})`);
  }
  save(p, s);
}

{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = text(p);
  const deriveMarker = `  const paymentDebts = getOutstandingInvoicesOldestFirst(subscriber);
  const totalDebt = paymentDebts.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.remainingAmount || 0)), 0);`;
  if (!s.includes('const paymentDebts = getOutstandingInvoicesOldestFirst(subscriber);')) {
    const anchor = `  if (!isOpen || !subscriber) return null;
  if (!hasMonthlyPricing(pricingTiers)) return null;`;
    if (s.includes(anchor)) s = s.replace(anchor, `${anchor}
${deriveMarker}`);
  }
  if (!s.includes('getOutstandingInvoicesOldestFirst')) {
    console.warn('Financial type repair: payment debt helper is not referenced');
  }
  if (!s.includes('paymentAmount: Math.round(partialAmount)')) {
    console.warn('Financial type repair: payment settlement payload is not normalized');
  }
  save(p, s);
}

{
  const p = 'src/App.tsx';
  let s = text(p);
  const exact = `const newInv = createInitialInvoiceForSubscriber({
                  ...newSubscriber,
                  tier: newSubscriber.tier,
                }, currentPricingTiers, activeTariff.id);`;
  if (s.includes(exact)) {
    s = s.replace(exact, `const newInv = createInitialInvoiceForSubscriber({
                  ...newSubscriber,
                  tier: newSubscriber.tier as SubscriptionTier,
                } as Subscriber, currentPricingTiers, activeTariff.id);`);
  }
  if (!s.includes('tier: newSubscriber.tier as SubscriptionTier')) {
    console.warn('Financial type repair: initial invoice tier cast marker not found');
  }
  save(p, s);
}

// Absolute final UI guard. Some legacy build patchers can inject the same three-card
// dashboard row more than once. Remove only duplicate JSX presentation blocks; do not
// touch the shared financial summary or any accounting calculation.
{
  const p = 'src/components/DashboardView.tsx';
  let s = text(p);
  const debtCardCount = () => (s.match(/ديون الشهر السابق/g) || []).length;
  const debtModalCount = () => (s.match(/مدينو الشهر السابق/g) || []).length;

  while (debtCardCount() > 1) {
    const phraseAt = s.lastIndexOf('ديون الشهر السابق');
    const sectionStart = s.lastIndexOf('<section', phraseAt);
    const sectionEnd = s.indexOf('</section>', phraseAt);
    if (sectionStart < 0 || sectionEnd < 0) {
      throw new Error('Dashboard duplicate guard: duplicate finance card block could not be isolated');
    }
    s = s.slice(0, sectionStart) + s.slice(sectionEnd + '</section>'.length);
  }

  // Each injected card group owns one previous-debt modal. If a duplicate group was
  // removed, remove only the trailing duplicate modal and preserve the canonical one.
  while (debtModalCount() > 1) {
    const phraseAt = s.lastIndexOf('مدينو الشهر السابق');
    const modalStart = s.lastIndexOf('      {showPreviousDebtList && (', phraseAt);
    const walletMarker = '      {/* 2. بطاقة القاصة (المحفظة) */}';
    const modalEnd = s.indexOf(walletMarker, phraseAt);
    if (modalStart < 0 || modalEnd < 0) {
      throw new Error('Dashboard duplicate guard: duplicate previous-debt modal could not be isolated');
    }
    s = s.slice(0, modalStart) + s.slice(modalEnd);
  }

  if (debtCardCount() !== 1 || debtModalCount() !== 1) {
    throw new Error(`Dashboard duplicate guard: expected one finance row/modal, found ${debtCardCount()}/${debtModalCount()}`);
  }
  save(p, s);
}

console.log('Production financial type/import repair applied.');

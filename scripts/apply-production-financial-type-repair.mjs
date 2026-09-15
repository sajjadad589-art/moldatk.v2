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

// Absolute final UI guard: this dashboard finance/discount row is injected by legacy
// build patchers. Keep exactly one rendered copy without touching any accounting values.
{
  const p = 'src/components/DashboardView.tsx';
  let s = text(p);
  const phraseCount = () => (s.match(/ديون الشهر السابق/g) || []).length;

  if (phraseCount() > 1 && s.includes('data-ampere-discount-dashboard-desktop-v1')) {
    const markerAt = s.indexOf('data-ampere-discount-dashboard-desktop-v1');
    const sectionStart = s.lastIndexOf('<section', markerAt);
    const walletMarker = '      {/* 2. بطاقة القاصة (المحفظة) */}';
    const blockEnd = s.indexOf(walletMarker, markerAt);
    if (sectionStart >= 0 && blockEnd > sectionStart) {
      s = s.slice(0, sectionStart) + s.slice(blockEnd);
    }
  }

  const finalCount = phraseCount();
  if (finalCount !== 1) {
    throw new Error(`Dashboard duplicate guard: expected exactly one previous-debt finance row, found ${finalCount}`);
  }
  save(p, s);
}

console.log('Production financial type/import repair applied.');

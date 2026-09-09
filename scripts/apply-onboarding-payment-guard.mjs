import fs from 'node:fs';

const p = 'src/components/SubscriberModal.tsx';
let s = fs.readFileSync(p, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Onboarding payment guard: ${m}`); };

// A subscriber deliberately added with no current-month debt is not a payment that can
// be "cancelled". Hide that action and defensively stop the quick-payment handler too.
if (!s.includes('const isOnboardingNoCurrentCharge =')) {
  const anchor = "  const settlementCurrentRemaining = settlementCurrentInvoice && !String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')\n    ? getInvoiceRemaining(settlementCurrentInvoice)\n    : 0;";
  must(s.includes(anchor), 'settlement helper anchor missing');
  s = s.replace(anchor, `${anchor}\n  const isOnboardingNoCurrentCharge = Boolean(settlementCurrentInvoice && String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));`);
}

const quickStart = s.indexOf('  const handleQuickPayment = () => {');
const quickEnd = quickStart >= 0 ? s.indexOf('\n\n  const handleCustomPayment', quickStart) : -1;
must(quickStart >= 0 && quickEnd > quickStart, 'quick-payment block missing');
let quick = s.slice(quickStart, quickEnd);
if (!quick.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) {
  const ensured = '    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);';
  must(quick.includes(ensured), 'quick-payment ensured invoice anchor missing');
  quick = quick.replace(ensured, `${ensured}\n    if (String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;`);
  s = s.slice(0, quickStart) + quick + s.slice(quickEnd);
}

s = s.replace('{isPaid && !isFree && (', '{isPaid && !isFree && !isOnboardingNoCurrentCharge && (');

must(s.includes('!isOnboardingNoCurrentCharge && ('), 'zero-charge cancel action is not guarded');
fs.writeFileSync(p, s, 'utf8');
console.log('Zero-charge onboarding subscribers are protected from fake payment cancellation.');

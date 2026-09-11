import fs from 'node:fs';

const p = 'src/components/SubscriberModal.tsx';
let s = fs.readFileSync(p, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Onboarding payment guard: ${m}`); };

// A subscriber deliberately added with no current-month charge must not get a fake
// "cancel current month payment" action. However, that marker must NEVER block a real
// outstanding debt that exists in another month. This matters when an account was added
// with a zero current charge but a prior/other-month debt was recorded separately.
if (!s.includes('const isOnboardingNoCurrentCharge =')) {
  const anchor = "  const settlementCurrentRemaining = settlementCurrentInvoice && !String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')\n    ? getInvoiceRemaining(settlementCurrentInvoice)\n    : 0;";
  must(s.includes(anchor), 'settlement helper anchor missing');
  s = s.replace(anchor, `${anchor}\n  const isOnboardingNoCurrentCharge = Boolean(settlementCurrentInvoice && String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));`);
}

const quickStart = s.indexOf('  const handleQuickPayment = () => {');
const quickEnd = quickStart >= 0 ? s.indexOf('\n\n  const handleCustomPayment', quickStart) : -1;
must(quickStart >= 0 && quickEnd > quickStart, 'quick-payment block missing');
let quick = s.slice(quickStart, quickEnd);

// Remove the old unconditional guard. It caused the visible payment button to do nothing
// whenever the active month had an onboarding zero-charge marker, even if another invoice
// still had real debt.
quick = quick.replace(
  "    if (String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;\n",
  ''
);

const ensured = '    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);';
const totalOutstandingLine = '    const totalOutstanding = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);';
must(quick.includes(ensured), 'quick-payment ensured invoice anchor missing');
must(quick.includes(totalOutstandingLine), 'quick-payment outstanding calculation missing');

if (!quick.includes('const onboardingNoCurrentCharge =')) {
  quick = quick.replace(
    totalOutstandingLine,
    `${totalOutstandingLine}\n    const onboardingNoCurrentCharge = String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');\n    // Zero-charge only blocks a fake cancellation/payment when there is truly no debt.\n    // If any invoice still has money due, full payment must continue normally.\n    if (onboardingNoCurrentCharge && totalOutstanding <= 0) return;`
  );
}

must(!quick.includes("if (String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;"), 'legacy unconditional onboarding payment block still present');
must(quick.includes('if (onboardingNoCurrentCharge && totalOutstanding <= 0) return;'), 'debt-aware onboarding guard missing');
s = s.slice(0, quickStart) + quick + s.slice(quickEnd);

// Keep the cancellation action hidden for the zero-charge current month itself.
s = s.replace('{isPaid && !isFree && (', '{isPaid && !isFree && !isOnboardingNoCurrentCharge && (');

must(s.includes('!isOnboardingNoCurrentCharge && ('), 'zero-charge cancel action is not guarded');
fs.writeFileSync(p, s, 'utf8');
console.log('Zero-charge onboarding guard fixed: real debt payments remain enabled; fake current-month cancellation stays blocked.');

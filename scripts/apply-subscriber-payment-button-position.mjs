import fs from 'node:fs';

const path = 'src/components/SubscriberModal.tsx';
if (!fs.existsSync(path)) throw new Error('Subscriber payment position: SubscriberModal.tsx missing');

let source = fs.readFileSync(path, 'utf8');

const whatsappMarker = source.indexOf('WHATSAPP_PRIMARY_ACTION_V1');
const lowerActionsMarker = source.indexOf('LOWER_PAYMENT_ACTIONS_V1');
if (whatsappMarker < 0 || lowerActionsMarker < 0 || lowerActionsMarker <= whatsappMarker) {
  throw new Error('Subscriber payment position: expected subscriber profile markers missing');
}

// The WhatsApp layout pass intentionally owns the payment behavior. This pass only
// moves the existing quick-payment JSX block, unchanged, to the requested visual
// position: immediately below the subscriber details card and above the lower actions.
const paymentStart = source.indexOf('\n            {!isPaid && !isFree && (', whatsappMarker);
const detailsStart = paymentStart >= 0
  ? source.indexOf('\n            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">', paymentStart)
  : -1;

if (paymentStart < 0 || detailsStart < 0 || detailsStart <= paymentStart || detailsStart >= lowerActionsMarker) {
  throw new Error('Subscriber payment position: quick-payment block or details card not found safely');
}

const paymentBlock = source.slice(paymentStart, detailsStart);
source = source.slice(0, paymentStart) + source.slice(detailsStart);

const refreshedLowerActionsMarker = source.indexOf('            {/* LOWER_PAYMENT_ACTIONS_V1 */}');
if (refreshedLowerActionsMarker < 0) {
  throw new Error('Subscriber payment position: lower actions marker missing after extraction');
}

const positionedPaymentBlock = `\n            {/* PAYMENT_BUTTON_BELOW_DETAILS_V1 */}${paymentBlock}\n`;
source = source.slice(0, refreshedLowerActionsMarker) + positionedPaymentBlock + source.slice(refreshedLowerActionsMarker);

const detailsPos = source.indexOf('rounded-3xl overflow-hidden shadow-sm');
const paymentPos = source.indexOf('PAYMENT_BUTTON_BELOW_DETAILS_V1');
const lowerPos = source.indexOf('LOWER_PAYMENT_ACTIONS_V1');
if (!(detailsPos >= 0 && paymentPos > detailsPos && lowerPos > paymentPos)) {
  throw new Error('Subscriber payment position: final order must be details -> payment -> lower actions');
}

// Safety checks: moving the block must not change its existing payment handler or label.
if (!paymentBlock.includes('onClick={handleQuickPayment}')) {
  throw new Error('Subscriber payment position: payment handler changed or missing');
}
if (!paymentBlock.includes('تسديد المشترك')) {
  throw new Error('Subscriber payment position: payment action label missing');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Moved the existing subscriber payment button below the details card without changing payment logic.');

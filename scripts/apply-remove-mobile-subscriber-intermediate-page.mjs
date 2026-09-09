import fs from 'node:fs';

const path = 'src/components/mobile/MobileSubscribers.tsx';
if (!fs.existsSync(path)) throw new Error('Mobile subscriber cleanup: MobileSubscribers.tsx missing');

let source = fs.readFileSync(path, 'utf8');

// Legacy Workmode patches may replace the subscriber-card click with an extra
// intermediate detail screen. The canonical SubscriberModal already owns the
// subscriber profile, real payment, custom payment and invoice history, so mobile
// subscriber cards must open it directly.
source = source.replace(
  /onClick=\{\(\) => setSelectedSubscriber\(sub\)\}/g,
  'onClick={() => onOpenSubscriberModal(sub)}'
);

const markerIndex = source.indexOf('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR');
if (markerIndex >= 0) {
  const blockStart = source.lastIndexOf('\n  if (selectedSubscriber) {', markerIndex);
  const nextMainReturn = source.indexOf('\n  return (\n', markerIndex);

  if (blockStart < 0 || nextMainReturn < 0 || nextMainReturn <= blockStart) {
    throw new Error('Mobile subscriber cleanup: could not safely locate redundant detail page bounds');
  }

  source = source.slice(0, blockStart) + '\n' + source.slice(nextMainReturn);
}

// Remove the state used only by the deleted intermediate page.
source = source.replace(
  /\n\s*const \[selectedSubscriber, setSelectedSubscriber\] = useState<Subscriber \| null>\(null\);\s*/g,
  '\n'
);

// Defensive cleanup in case a legacy patch left a card click behind without the page marker.
source = source.replace(/setSelectedSubscriber\(sub\)/g, 'onOpenSubscriberModal(sub)');

if (source.includes('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR')) {
  throw new Error('Mobile subscriber cleanup: redundant detail page marker still present');
}
if (source.includes('if (selectedSubscriber)')) {
  throw new Error('Mobile subscriber cleanup: redundant selectedSubscriber detail flow still present');
}
if (!source.includes('onClick={() => onOpenSubscriberModal(sub)}')) {
  throw new Error('Mobile subscriber cleanup: subscriber cards are not routed directly to SubscriberModal');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Removed redundant mobile subscriber detail page; subscriber cards now open the canonical subscriber interface directly.');

// This file is already the absolute last release pass. Keep dashboard accounting
// consistency here as well so older build-time patches cannot restore stale counters
// or a different cashbox formula afterwards.
await import('./apply-dashboard-wallet-consistency-fix-v3.mjs');

// Final dashboard status rule: unpaid/partial subscribers and any real outstanding
// balance must remain visible as unpaid even when the current-month tariff row is absent.
await import('./apply-dashboard-outstanding-status-fix.mjs');

// Final subscriber action layout: large WhatsApp at the top of the first page,
// no call action, and cancellation/custom payment controls moved to the lower action area.
await import('./apply-subscriber-whatsapp-action-layout.mjs');

// Visual-only final pass: keep the existing payment handler untouched, but place the
// main subscriber payment button directly below the details card (above custom/cancel).
await import('./apply-subscriber-payment-button-position.mjs');

// iPhone-only PWA install assistant. This runs last so earlier brand/PWA build patches
// cannot remove the Safari installation helper from the final production HTML.
await import('./apply-ios-safari-install.mjs');

// Absolute final collector QA pass. Keep it after all historic POS/cloud mutations so
// cash settlement, partial-payment carry, free-subscriber filtering and collector RLS
// safety are the state that actually reaches Vite/production.
await import('./apply-collector-payment-integrity-fix.mjs');

// Collector dashboard numbers must be derived after the payment/ledger finalizer so
// every headline card and every debtor row uses the exact same canonical balances.
await import('./apply-collector-dashboard-accounting-fix.mjs');

// Final accounting source of truth for owner/mobile/desktop dashboards and wallet.
// Runs after every historic accounting patch so no stale formula survives the build.
await import('./apply-authoritative-financial-summary-v2.mjs');

// New subscriber onboarding debt decision and true negotiated lump settlement must be
// the absolute final accounting pass. It also upgrades the source-of-truth helper so
// settled amounts, not original tariff amounts, drive owner dashboard/cashbox totals.
await import('./apply-onboarding-debt-lump-settlement-final.mjs');

// A zero-current-charge onboarding marker is a billing decision, not a payment. Prevent
// the ordinary paid-state UI from offering a fake cancellation that would recreate debt.
await import('./apply-onboarding-payment-guard.mjs');

// Absolute final collector/manager parity pass. It removes free settlement from the
// collector UI, preserves custom + lump settlement, and closes the cloud-sync race that
// could otherwise drop an audit/payment detail written during an active push.
await import('./apply-collector-manager-sync-payment-parity-final.mjs');

// Final cross-interface accounting gate. Collector and owner must classify the same
// subscriber status identically, and production is blocked if payment/sync invariants drift.
await import('./apply-final-financial-interface-parity.mjs');

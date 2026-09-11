import fs from 'node:fs';

const path = 'src/components/mobile/MobileSubscribers.tsx';
if (!fs.existsSync(path)) throw new Error('Mobile subscriber cleanup: MobileSubscribers.tsx missing');

let source = fs.readFileSync(path, 'utf8');
source = source.replace(/onClick=\{\(\) => setSelectedSubscriber\(sub\)\}/g, 'onClick={() => onOpenSubscriberModal(sub)}');
const markerIndex = source.indexOf('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR');
if (markerIndex >= 0) {
  const blockStart = source.lastIndexOf('\n  if (selectedSubscriber) {', markerIndex);
  const nextMainReturn = source.indexOf('\n  return (\n', markerIndex);
  if (blockStart < 0 || nextMainReturn < 0 || nextMainReturn <= blockStart) throw new Error('Mobile subscriber cleanup: could not safely locate redundant detail page bounds');
  source = source.slice(0, blockStart) + '\n' + source.slice(nextMainReturn);
}
source = source.replace(/\n\s*const \[selectedSubscriber, setSelectedSubscriber\] = useState<Subscriber \| null>\(null\);\s*/g, '\n');
source = source.replace(/setSelectedSubscriber\(sub\)/g, 'onOpenSubscriberModal(sub)');
if (source.includes('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR')) throw new Error('Mobile subscriber cleanup: redundant detail page marker still present');
if (source.includes('if (selectedSubscriber)')) throw new Error('Mobile subscriber cleanup: redundant selectedSubscriber detail flow still present');
if (!source.includes('onClick={() => onOpenSubscriberModal(sub)}')) throw new Error('Mobile subscriber cleanup: subscriber cards are not routed directly to SubscriberModal');
fs.writeFileSync(path, source, 'utf8');
console.log('Removed redundant mobile subscriber detail page; subscriber cards now open the canonical subscriber interface directly.');

await import('./apply-dashboard-wallet-consistency-fix-v3.mjs');
await import('./apply-dashboard-outstanding-status-fix.mjs');
await import('./apply-subscriber-whatsapp-action-layout.mjs');
await import('./apply-subscriber-payment-button-position.mjs');
await import('./apply-ios-safari-install.mjs');
await import('./apply-collector-payment-integrity-fix.mjs');
await import('./patch-final-finance-idempotence-v2.mjs');
await import('./apply-collector-dashboard-accounting-fix.mjs');
await import('./apply-authoritative-financial-summary-v2.mjs');
await import('./patch-onboarding-finalizer-idempotence.mjs');
await import('./apply-onboarding-debt-lump-settlement-final.mjs');
await import('./apply-onboarding-payment-guard.mjs');
await import('./apply-collector-manager-sync-payment-parity-final.mjs');
await import('./apply-final-financial-interface-parity.mjs');
await import('./apply-live-finance-reconciliation-v1.mjs');
await import('./apply-release-version-1-3-20.mjs');

await import('./patch-recurring-ampere-discount-finalizer.mjs');
await import('./repair-ampere-discount-submit-after-onboarding.mjs');
await import('./apply-recurring-ampere-discount-final.mjs');
await import('./patch-discount-dashboard-finalizer.mjs');
await import('./apply-discount-dashboard-boxes-final.mjs');
await import('./apply-mobile-wallet-runtime-fix-final.mjs');
await import('./apply-release-readiness-hardening.mjs');
await import('./apply-subscription-lock-stability-fix.mjs');
await import('./apply-minimal-branded-receipt-final.mjs');

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
await import('./apply-dashboard-wallet-consistency-fix.mjs');

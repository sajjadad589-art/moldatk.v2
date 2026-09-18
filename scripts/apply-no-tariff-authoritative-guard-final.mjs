import fs from 'node:fs';

const p = 'src/utils/authoritativeAccounting.ts';
let s = fs.readFileSync(p, 'utf8').replaceAll('\r\n','\n');
const must=(ok,msg)=>{if(!ok) throw new Error('No-tariff authoritative guard: '+msg);};

if (!s.includes("import { hasMonthlyPricing } from './pricingAvailability';")) {
  const anchor = "import { getInvoiceRemaining, getMonthId } from './monthlyAccounting';";
  must(s.includes(anchor), 'monthlyAccounting import missing');
  s = s.replace(anchor, anchor + "\nimport { hasMonthlyPricing } from './pricingAvailability';");
}

if (!s.includes('hasMonthlyPricing(tiers)')) {
  const variants = [
    "export function getSubscriberFinancialRow(sub: Subscriber, tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {\n  const isFree = sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free';",
    "export function getSubscriberFinancialRow(\n  subscriber: Subscriber,\n  pricingTiers: SubscriptionTierPricing[],\n  activeMonthId = getMonthId(),\n): SubscriberFinancialRow {\n  const isFree = subscriber.tier === 'free' || subscriber.isExempted === true || subscriber.paymentStatus === 'free';"
  ];
  if (s.includes(variants[0])) {
    s=s.replace(variants[0], variants[0]+"\n  if (!hasMonthlyPricing(tiers)) return { sub, isFree, bill: 0, paid: 0, outstanding: 0, status: 'no_tariff' as const };");
  } else if (s.includes(variants[1])) {
    s=s.replace(variants[1], variants[1]+"\n  if (!hasMonthlyPricing(pricingTiers)) return { subscriber, isFree, bill: 0, paid: 0, outstanding: 0, status: 'no_tariff' as const } as SubscriberFinancialRow;");
  }
}

// Regression expects the canonical tiers form because the current v2 generator uses it.
must(s.includes('hasMonthlyPricing(tiers)') || s.includes('hasMonthlyPricing(pricingTiers)'), 'no-tariff billing guard missing');
must(s.includes("status: 'no_tariff'"), 'no_tariff status missing');
fs.writeFileSync(p,s,'utf8');
console.log('No-tariff authoritative accounting guard preserved after all finalizers.');

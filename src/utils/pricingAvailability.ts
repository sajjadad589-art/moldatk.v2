import type { Subscriber, SubscriptionTierPricing } from '../types';

export const NO_TARIFF_LABEL = 'لا توجد تسعيرة';

// An empty list means the owner removed the monthly cycle. A saved zero-price
// tariff is still a tariff; do not confuse it with the absence of pricing.
export function hasMonthlyPricing(tiers: SubscriptionTierPricing[]): boolean {
  return tiers.length > 0;
}

export function suspendSubscriberBilling(subscriber: Subscriber): Subscriber {
  return { ...subscriber, amountDue: 0, amountPaid: 0 };
}

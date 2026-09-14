import type { SubscriptionTierPricing } from '../types';

const CANONICAL_TIER_TYPES = ['normal', 'commercial', 'golden', 'free'] as const;

type CanonicalTierType = (typeof CANONICAL_TIER_TYPES)[number];

const fallbackTiers: SubscriptionTierPricing[] = [
  {
    id: 'tier-normal',
    nameAr: 'نهاري',
    nameEn: 'Normal (Residential)',
    type: 'normal',
    pricePerAmpere: 0,
    fixedFee: 0,
    description: '',
    badgeColor: 'blue',
    is24Hours: false,
    priorityLevel: 1,
  },
  {
    id: 'tier-commercial',
    nameAr: 'محلات',
    nameEn: 'Commercial',
    type: 'commercial',
    pricePerAmpere: 0,
    fixedFee: 0,
    description: '',
    badgeColor: 'amber',
    is24Hours: false,
    priorityLevel: 2,
  },
  {
    id: 'tier-golden',
    nameAr: 'ذهبي',
    nameEn: 'Golden (VIP 24h)',
    type: 'golden',
    pricePerAmpere: 0,
    fixedFee: 0,
    description: '',
    badgeColor: 'emerald',
    is24Hours: true,
    priorityLevel: 3,
  },
  {
    id: 'tier-free',
    nameAr: 'مجاني',
    nameEn: 'Free Exemptions',
    type: 'free',
    pricePerAmpere: 0,
    fixedFee: 0,
    description: '',
    badgeColor: 'purple',
    is24Hours: false,
    priorityLevel: 0,
  },
];

const fixedArabicName = (type: string) => {
  switch (type) {
    case 'golden': return 'ذهبي';
    case 'commercial': return 'محلات';
    case 'free': return 'مجاني';
    case 'normal':
    default: return 'نهاري';
  }
};

/**
 * Restores the four core subscription tiers for an active monthly tariff while
 * preserving every price already stored for that month. Global/default tiers
 * are used only as a template when a tier is genuinely missing.
 *
 * Historical tariff snapshots must not be passed through this helper unless
 * they are being intentionally repaired, because old months are immutable.
 */
export const buildCanonicalMonthlyTiers = (
  existing: SubscriptionTierPricing[] = [],
  defaults: SubscriptionTierPricing[] = []
): SubscriptionTierPricing[] => {
  const defaultByType = new Map(defaults.map(tier => [tier.type, tier]));
  const existingByType = new Map(existing.map(tier => [tier.type, tier]));

  const canonical = fallbackTiers.map(seed => {
    const fromDefaults = defaultByType.get(seed.type);
    const current = existingByType.get(seed.type);
    const merged = { ...seed, ...(fromDefaults || {}), ...(current || {}) } as SubscriptionTierPricing;
    const numericPrice = Number(merged.pricePerAmpere || 0);

    return {
      ...merged,
      id: current?.id || fromDefaults?.id || seed.id,
      type: seed.type as CanonicalTierType,
      nameAr: fixedArabicName(seed.type),
      pricePerAmpere: seed.type === 'free' ? 0 : Math.max(0, Number.isFinite(numericPrice) ? numericPrice : 0),
      fixedFee: 0,
      description: merged.description || '',
    };
  });

  const extras = existing.filter(tier => !CANONICAL_TIER_TYPES.includes(tier.type as CanonicalTierType));
  return [...canonical, ...extras];
};

export const hasAllCanonicalMonthlyTiers = (tiers: SubscriptionTierPricing[] = []) =>
  CANONICAL_TIER_TYPES.every(type => tiers.some(tier => tier.type === type));

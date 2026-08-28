export function formatCurrency(amount: number, currency: string = 'د.ع'): string {
  if (isNaN(amount)) return `0 ${currency}`;
  return `${amount.toLocaleString('ar-IQ')} ${currency}`;
}

export function formatNumberArabic(num: number): string {
  if (isNaN(num)) return '0';
  return num.toLocaleString('ar-IQ');
}

export function calculateSubscriberBill(
  amperes: number,
  tierType: string,
  pricingList: Array<{ type: string; pricePerAmpere: number; fixedFee: number }>
): { pricePerAmpere: number; fixedFee: number; total: number } {
  const tier = pricingList.find(p => p.type === tierType);
  if (!tier || tier.type === 'free') {
    return { pricePerAmpere: 0, fixedFee: 0, total: 0 };
  }
  const total = (amperes * tier.pricePerAmpere) + (tier.fixedFee || 0);
  return {
    pricePerAmpere: tier.pricePerAmpere,
    fixedFee: tier.fixedFee,
    total,
  };
}

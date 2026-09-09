import fs from 'node:fs';
import type { Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../src/types';
import { calculateMonthlyCharge, ensureMonthInvoice, getInvoiceRemaining } from '../src/utils/monthlyAccounting';
import { getAmpereDiscountDashboardSummary } from '../src/utils/discountAccounting';
import { summarizeSubscribers } from '../src/utils/authoritativeAccounting';

const expect = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`Ampere discount regression: ${message}`);
};

const tiers: SubscriptionTierPricing[] = [{
  id: 'normal',
  nameAr: 'عادي',
  nameEn: 'Normal',
  type: 'normal',
  pricePerAmpere: 15000,
  fixedFee: 0,
  description: '',
  badgeColor: '',
  is24Hours: false,
  priorityLevel: 1,
}];

const discountedBase: Subscriber = {
  id: 'discounted',
  code: 'MW-D',
  fullName: 'مشترك خصم',
  phone: '',
  tier: 'normal',
  amperes: 5,
  ampereDiscount: 1,
  ampereDiscountReason: 'اتفاق خاص',
  paymentStatus: 'unpaid',
  amountDue: 0,
  amountPaid: 0,
  invoicesHistory: [],
};

const charge = calculateMonthlyCharge(discountedBase, tiers);
expect(charge.originalAmperes === 5, 'original amperes must stay physical 5A');
expect(charge.discountedAmperes === 1, 'discount must be 1A');
expect(charge.billedAmperes === 4, 'billed amperes must be 4A');
expect(charge.grossTotal === 75000, 'gross value must remain auditable at 75,000');
expect(charge.discountAmount === 15000, 'discount money must be 15,000');
expect(charge.total === 60000, 'monthly charge after discount must be 60,000');

const current = ensureMonthInvoice(discountedBase, tiers, '2026-09', '9-2026', '2026-09-01');
expect(current.currentInvoice.totalAmount === 60000, 'created invoice must use discounted total');
expect(current.currentInvoice.originalAmperes === 5, 'invoice snapshot original amps missing');
expect(current.currentInvoice.discountedAmperes === 1, 'invoice snapshot discounted amps missing');
expect(current.currentInvoice.billedAmperes === 4, 'invoice snapshot billed amps missing');
expect(current.currentInvoice.discountAmount === 15000, 'invoice snapshot discount money missing');

const previousDebt: SubscriberInvoice = {
  id: 'inv-2026-08-discounted',
  subscriberId: 'discounted',
  monthId: '2026-08',
  monthNameAr: '8-2026',
  issueDate: '2026-08-01',
  amperes: 5,
  tier: 'normal',
  pricePerAmpere: 15000,
  fixedFee: 0,
  totalAmount: 60000,
  paidAmount: 45000,
  remainingAmount: 15000,
  status: 'partial',
  originalAmperes: 5,
  discountedAmperes: 1,
  billedAmperes: 4,
  grossAmountBeforeDiscount: 75000,
  discountAmount: 15000,
};

const discountedSubscriber: Subscriber = {
  ...discountedBase,
  invoicesHistory: [current.currentInvoice, previousDebt],
  amountDue: 75000,
  amountPaid: 0,
  paymentStatus: 'unpaid',
};

const paidInvoice: SubscriberInvoice = {
  id: 'inv-2026-09-paid',
  subscriberId: 'paid',
  monthId: '2026-09',
  monthNameAr: '9-2026',
  issueDate: '2026-09-01',
  amperes: 5,
  tier: 'normal',
  pricePerAmpere: 15000,
  fixedFee: 0,
  totalAmount: 75000,
  paidAmount: 75000,
  remainingAmount: 0,
  status: 'paid',
};

const paidSubscriber: Subscriber = {
  id: 'paid',
  code: 'MW-P',
  fullName: 'مشترك مسدد',
  phone: '',
  tier: 'normal',
  amperes: 5,
  paymentStatus: 'paid',
  amountDue: 0,
  amountPaid: 75000,
  invoicesHistory: [paidInvoice],
};

const dashboard = getAmpereDiscountDashboardSummary([discountedSubscriber, paidSubscriber], tiers, '2026-09');
expect(dashboard.previousMonthId === '2026-08', 'previous month id must be 2026-08');
expect(dashboard.previousDebtSubscribers === 1, 'previous-month debtor count must be one');
expect(dashboard.previousDebtAmount === 15000, 'previous-month debt amount must be 15,000');
expect(dashboard.originalBillableAmperes === 10, 'gross billable amperes must be 10A');
expect(dashboard.discountedAmperes === 1, 'dashboard discounted amperes must be 1A');
expect(dashboard.billedAmperes === 9, 'dashboard billed amperes must be 9A');
expect(dashboard.monthlyDiscountAmount === 15000, 'dashboard discount money must be 15,000');

const summary = summarizeSubscribers([discountedSubscriber, paidSubscriber], tiers, '2026-09');
expect(summary.monthTotal === 135000, 'owner monthly total must be net of ampere discount');
expect(summary.collected === 75000, 'collected cash must not include discount');
expect(summary.outstanding === 75000, 'outstanding must preserve previous debt + discounted current debt');
expect(summary.paidSubscribers.length === 1, 'paid subscriber count must remain correct');
expect(summary.unpaidSubscribers.length === 1, 'unpaid subscriber count must remain correct');

const fullDiscount: Subscriber = { ...discountedBase, id: 'full-discount', ampereDiscount: 5 };
const zeroCharge = calculateMonthlyCharge(fullDiscount, tiers);
expect(zeroCharge.total === 0 && zeroCharge.billedAmperes === 0 && zeroCharge.discountAmount === 75000, '100% ampere discount must create zero monthly charge');
const zeroInvoice = ensureMonthInvoice(fullDiscount, tiers, '2026-09', '9-2026', '2026-09-01').currentInvoice;
expect(getInvoiceRemaining(zeroInvoice) === 0 && zeroInvoice.status === 'paid', 'zero charge must never become unpaid debt');

const sync = fs.readFileSync('src/lib/useGeneratorCloudSync.ts', 'utf8');
const modal = fs.readFileSync('src/components/SubscriberModal.tsx', 'utf8');
const mobileDashboard = fs.readFileSync('src/components/mobile/MobileDashboard.tsx', 'utf8');
expect(sync.includes('ampere_discount: Number(s.ampereDiscount || 0)'), 'cloud subscriber discount write missing');
expect(sync.includes('discount_amount: i.discountAmount'), 'cloud invoice discount snapshot missing');
expect(modal.includes('data-ampere-discount-editor-v1'), 'subscriber discount editor missing');
expect(mobileDashboard.includes('data-ampere-discount-dashboard-mobile-v1'), 'mobile dashboard discount cards missing');

console.log('Recurring ampere discount + previous-month debt dashboard regression: OK');

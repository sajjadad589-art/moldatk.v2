import fs from 'node:fs';
import { getCanonicalSubscriberPaymentStatus } from '../src/utils/monthlyAccounting';
import type { Subscriber } from '../src/types';

const must = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Owner audit regression failed: ${message}`);
};
const read = (path: string) => fs.readFileSync(path, 'utf8');

const receipt = read('src/components/InvoiceReceiptModal.tsx');
must(receipt.includes('MOLDATK_CANONICAL_RECEIPT_STATUS_V1'), 'receipt canonical status marker missing');
must(receipt.includes('const finalized = Boolean(!invoiceCancelled'), 'receipt still requires an invoice object before printing');
must(receipt.includes('invoiceFullyPaidByAmounts'), 'full paid amounts do not override stale partial label');

const modal = read('src/components/SubscriberModal.tsx');
must(modal.includes('MOLDATK_EFFECTIVE_PAYMENT_MONTH_V1'), 'dynamic payment month marker missing');
must(!modal.includes("monthId: '2026-08'"), 'hard-coded August 2026 payment month remains');
must(modal.includes('effectivePaymentMonthId'), 'active/current payment month is not used');

const settings = read('src/components/SettingsFolderView.tsx');
must(!settings.includes('بحث في المجلدات والإعدادات...'), 'removed settings search is still rendered');
must(!settings.includes('كافة المجلدات'), 'removed settings categories are still rendered');
must(settings.includes('اكتب اسم الكابينة أولاً'), 'empty cabinet validation is missing');

const mobileSettings = read('src/components/mobile/MobileSettings.tsx');
must(!mobileSettings.includes('{f.badge}'), 'stale static mobile folder badge remains');

const mobileSubscribers = read('src/components/mobile/MobileSubscribers.tsx');
const desktopSubscribers = read('src/components/SubscribersView.tsx');
must(mobileSubscribers.includes('getCanonicalSubscriberPaymentStatus'), 'mobile counters do not use canonical status');
must(desktopSubscribers.includes('getCanonicalSubscriberPaymentStatus'), 'desktop counters do not use canonical status');

const fullPaidWithStalePartialLabel: Subscriber = {
  id: 'audit-paid', code: 'A-1', fullName: 'Paid', phone: '', tier: 'normal', amperes: 5,
  paymentStatus: 'partial', amountDue: 0, amountPaid: 62000,
  invoicesHistory: [{
    id: 'inv-audit-paid', subscriberId: 'audit-paid', monthId: '2026-09', monthNameAr: '9-2026',
    issueDate: '2026-09-01', amperes: 5, tier: 'normal', pricePerAmpere: 12000, fixedFee: 2000,
    totalAmount: 62000, paidAmount: 62000, remainingAmount: 0, status: 'partial',
  }],
};
must(getCanonicalSubscriberPaymentStatus(fullPaidWithStalePartialLabel) === 'paid', 'fully paid invoice with zero remaining is not normalized to paid');

const partial: Subscriber = {
  ...fullPaidWithStalePartialLabel,
  id: 'audit-partial', code: 'A-2', amountDue: 32000, amountPaid: 30000,
  invoicesHistory: [{
    ...fullPaidWithStalePartialLabel.invoicesHistory![0], id: 'inv-audit-partial', subscriberId: 'audit-partial',
    paidAmount: 30000, remainingAmount: 32000, status: 'partial',
  }],
};
must(getCanonicalSubscriberPaymentStatus(partial) === 'partial', 'real partial invoice is not kept partial');

console.log('Owner audit screenshot regression passed: receipt/payment status, print readiness, shared counters, settings cleanup and cabinet validation are protected.');

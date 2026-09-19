import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SunmiReceiptPayload {
  header: string;
  systemTitle?: string;
  subTitle?: string;
  location?: string;
  ownerPhone?: string;
  receiptNumber: string;
  subscriberName: string;
  subscriberCode: string;
  phone?: string;
  lineName?: string;
  amperes: string;
  pricePerAmp: string;
  month: string;
  status: string;
  collector?: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  previousDebt?: string;
  currentCharge?: string;
  totalBeforePayment?: string;
  appliedToPreviousDebt?: string;
  appliedToCurrentMonth?: string;
  totalOutstandingAfter?: string;
  note?: string;
  issueDate: string;
  printTime: string;
  portalUrl?: string;
  qrDataUrl?: string;

  showLogo?: boolean;
  showSystemBrand?: boolean;
  showGeneratorName?: boolean;
  showSubTitle?: boolean;
  showDate?: boolean;
  showReceiptNumber?: boolean;
  showSubscriberName?: boolean;
  showPhone?: boolean;
  showOwnerPhone?: boolean;
  showLocationAddress?: boolean;
  showLineName?: boolean;
  showAmperes?: boolean;
  showPricePerAmp?: boolean;
  showPaymentMonth?: boolean;
  showPaymentStatus?: boolean;
  showCollectorName?: boolean;
  showPreviousDebt?: boolean;
  showCurrentCharge?: boolean;
  showTotalBeforePayment?: boolean;
  showAppliedToPreviousDebt?: boolean;
  showAppliedToCurrentMonth?: boolean;
  showRemainingAfterPayment?: boolean;
  showReceivedAmount?: boolean;
  showThankYou?: boolean;
  showQr?: boolean;
  showFooterNotes?: boolean;
  showFooterSystemText?: boolean;

  dateLabel?: string;
  receiptNumberLabel?: string;
  subscriberNameLabel?: string;
  phoneLabel?: string;
  ownerPhoneLabel?: string;
  locationAddressLabel?: string;
  lineNameLabel?: string;
  amperesLabel?: string;
  pricePerAmpLabel?: string;
  paymentMonthLabel?: string;
  paymentStatusLabel?: string;
  collectorNameLabel?: string;
  previousDebtLabel?: string;
  currentChargeLabel?: string;
  totalBeforePaymentLabel?: string;
  appliedToPreviousDebtLabel?: string;
  appliedToCurrentMonthLabel?: string;
  remainingAfterPaymentLabel?: string;
  receivedAmountLabel?: string;
  thankYouText?: string;
  qrCaption?: string;
  footerSystemText?: string;
}

interface SunmiPrinterPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  printReceipt(options: { receipt: SunmiReceiptPayload }): Promise<{ printed: boolean }>;
}

const SunmiPrinter = registerPlugin<SunmiPrinterPlugin>('SunmiPrinter');

export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';

let printInFlight = false;
let lastPrintKey = '';
let lastPrintAt = 0;

export async function printSunmiReceipt(receipt: SunmiReceiptPayload): Promise<boolean> {
  if (!isNativeAndroid()) return false;

  const now = Date.now();
  const key = receipt.receiptNumber || `${receipt.subscriberCode}-${receipt.issueDate}-${receipt.paidAmount}`;
  if (printInFlight || (lastPrintKey === key && now - lastPrintAt < 2500)) {
    return true;
  }

  printInFlight = true;
  lastPrintKey = key;
  lastPrintAt = now;

  try {
    const state = await SunmiPrinter.isAvailable();
    if (!state.available) {
      // The service can still be in the process of binding; printReceipt itself retries briefly.
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    const result = await SunmiPrinter.printReceipt({ receipt });
    return Boolean(result?.printed);
  } finally {
    printInFlight = false;
  }
}

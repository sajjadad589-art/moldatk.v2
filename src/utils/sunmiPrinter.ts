import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SunmiReceiptPayload {
  header: string;
  location?: string;
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

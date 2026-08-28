import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Zap,
} from 'lucide-react';
import { Subscriber, GeneratorSpecs, SubscriptionTierPricing, SubscriberInvoice } from '../types';
import { formatCurrency, formatNumberArabic } from '../utils/formatters';
import { isNativeAndroid, printSunmiReceipt } from '../utils/sunmiPrinter';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  generatorSpecs: GeneratorSpecs;
  pricingTiers: SubscriptionTierPricing[];
  onMarkAsPaid: (subId: string) => void;
  autoPrint?: boolean;
  invoice?: SubscriberInvoice | null;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  generatorSpecs,
  pricingTiers,
  onMarkAsPaid,
  autoPrint = false,
  invoice = null,
}) => {
  const lastAutoPrintedReceiptRef = useRef<string>('');


  const customSettings = (() => {
    try {
      const saved = localStorage.getItem('moldatk_invoice_custom_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      printerType: 'thermal_58',
      headerTitle: generatorSpecs.generatorName,
      showPhaseName: true,
      showGeneratorName: true,
      showTotalAmount: true,
      showDueDebt: true,
      showAmperesCount: true,
      showAmperesPrice: true,
      showPaymentMonth: true,
      showCollectorName: true,
      showBarcode: true,
      customNoteText: 'شكراً لتسديدكم في الموعد المحدد، يرجى الاحتفاظ بالوصل.',
    };
  })();

  const currentSession = (() => {
    try {
      const saved = localStorage.getItem('moldatk_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  })();

  const currentTierType = invoice ? invoice.tier : subscriber?.tier;
  const currentTier = pricingTiers.find(p => p.type === currentTierType || p.id === currentTierType);

  const isCancelled = invoice ? invoice.status === 'cancelled' : false;
  const isPaid = invoice ? invoice.status === 'paid' : subscriber?.paymentStatus === 'paid';
  const isPartial = invoice ? invoice.status === 'partial' : subscriber?.paymentStatus === 'partial';
  const isFree = invoice ? invoice.status === 'free' : (subscriber?.paymentStatus === 'free' || subscriber?.tier === 'free');
  
  const displayAmperes = invoice?.amperes ?? subscriber?.amperes ?? 5;
  const displayPricePerAmp = invoice?.pricePerAmpere ?? currentTier?.pricePerAmpere ?? 0;
  const displayAmount = invoice ? invoice.totalAmount : (subscriber?.amountDue || (displayAmperes * displayPricePerAmp));
  const displayPaidAmount = invoice ? invoice.paidAmount : (subscriber?.amountPaid || (isPaid ? displayAmount : 0));
  const displayRemainingAmount = invoice ? invoice.remainingAmount : Math.max(0, displayAmount - displayPaidAmount);
  const displayMonth = invoice ? invoice.monthNameAr : 'شهر 8 (آب 2026)';
  const displayReceiptNumber = invoice?.receiptNumber || `REC-${subscriber?.code || subscriber?.subscriberCode || ''}-${invoice?.monthId || '2026-08'}`;
  const displayIssueDate = invoice?.issueDate || new Date().toISOString().split('T')[0];

  const handlePrint = async () => {
    const isFinalizedPayment = Boolean(invoice && (isPaid || isPartial || isFree));
    if (!isFinalizedPayment) {
      window.alert('لا يمكن طباعة وصل قبل إكمال عملية التسديد وحفظها.');
      return;
    }

    // On the Android/SUNMI app we bypass Android's browser print dialog entirely.
    // This gives the built-in 58mm printer exact text, strong black output and
    // eliminates the large top/bottom page margins caused by window.print().
    if (isNativeAndroid()) {
      try {
        const statusText = isCancelled
          ? 'ملغي'
          : isFree
            ? 'إعفاء مجاني'
            : isPaid
              ? 'مدفوع'
              : isPartial
                ? 'دفع جزئي'
                : 'غير مدفوع';

        await printSunmiReceipt({
          header: customSettings.headerTitle || generatorSpecs.generatorName || 'مولدتك',
          location: generatorSpecs.location || '',
          receiptNumber: displayReceiptNumber,
          subscriberName: subscriber?.fullName || '-',
          subscriberCode: subscriber?.code || subscriber?.subscriberCode || '-',
          phone: subscriber?.phone || '',
          lineName: (subscriber as any)?.lineName || (subscriber as any)?.line || '',
          amperes: `${displayAmperes} أمبير`,
          pricePerAmp: isFree ? '0 د.ع' : formatCurrency(displayPricePerAmp),
          month: displayMonth,
          status: statusText,
          collector: invoice?.collectorName || currentSession?.collectorName || (currentSession?.role === 'admin' ? 'الإدارة العامة' : 'المحاسب'),
          totalAmount: isFree ? 'إعفاء مجاني' : formatCurrency(displayAmount),
          paidAmount: formatCurrency(displayPaidAmount),
          remainingAmount: formatCurrency(displayRemainingAmount),
          note: customSettings.customNoteText || '',
          issueDate: displayIssueDate,
          printTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      } catch (error) {
        console.error('تعذر استخدام طابعة SUNMI المدمجة، سيتم استخدام طباعة المتصفح كبديل:', error);
        // Fall through to browser printing as a safe fallback.
      }
    }

    const receipt = document.getElementById('thermal-receipt-printable');
    if (!receipt) return;

    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '58mm';
      iframe.style.height = '1px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      const frameDocument = iframe.contentDocument || frameWindow?.document;
      if (!frameWindow || !frameDocument) {
        iframe.remove();
        return;
      }

      const inheritedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(node => node.outerHTML)
        .join('\n');

      frameDocument.open();
      frameDocument.write(`<!doctype html>
<html dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${inheritedStyles}
<style id="receipt-page-size">
  @page { size: 58mm auto; margin: 0 !important; }
  html, body {
    width: 58mm !important;
    min-width: 58mm !important;
    max-width: 58mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
    overflow: visible !important;
  }
  body {
    font-family: Arial, Tahoma, "Noto Sans Arabic", sans-serif !important;
    direction: rtl !important;
    font-weight: 700 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #thermal-receipt-printable {
    position: static !important;
    display: block !important;
    width: 56mm !important;
    min-width: 56mm !important;
    max-width: 56mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 1mm !important;
    padding: 0.5mm 1mm 0.5mm !important;
    box-sizing: border-box !important;
    background: #fff !important;
    color: #000 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-size: 13px !important;
    line-height: 1.3 !important;
    font-weight: 700 !important;
    overflow: visible !important;
    opacity: 1 !important;
  }
  #thermal-receipt-printable, #thermal-receipt-printable * {
    box-sizing: border-box !important;
    color: #000 !important;
    opacity: 1 !important;
    text-shadow: none !important;
    filter: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #thermal-receipt-printable strong,
  #thermal-receipt-printable b,
  #thermal-receipt-printable .font-black,
  #thermal-receipt-printable .font-bold { font-weight: 900 !important; }
  #thermal-receipt-printable .text-\\[8px\\] { font-size: 10px !important; }
  #thermal-receipt-printable .text-\\[9px\\] { font-size: 11px !important; }
  #thermal-receipt-printable .text-\\[10px\\] { font-size: 12px !important; }
  #thermal-receipt-printable .text-xs { font-size: 13px !important; }
  #thermal-receipt-printable svg { display: none !important; }
  #thermal-receipt-printable > * { break-inside: avoid !important; page-break-inside: avoid !important; }
</style>
</head>
<body>${receipt.outerHTML}</body>
</html>`);
      frameDocument.close();

      window.setTimeout(() => {
        const printedReceipt = frameDocument.getElementById('thermal-receipt-printable');
        if (!printedReceipt) {
          iframe.remove();
          return;
        }

        const pxHeight = Math.ceil(printedReceipt.scrollHeight || printedReceipt.getBoundingClientRect().height);
        const heightMm = Math.max(30, Math.ceil((pxHeight * 25.4) / 96));
        const pageStyle = frameDocument.getElementById('receipt-page-size');
        if (pageStyle) {
          pageStyle.textContent += `\n@page { size: 58mm ${heightMm}mm; margin: 0 !important; }\nhtml, body { height: ${heightMm}mm !important; min-height: ${heightMm}mm !important; }`;
        }

        iframe.style.height = `${pxHeight}px`;
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(() => iframe.remove(), 1200);
      }, 250);
    } catch (e) {
      console.error('فشل إرسال أمر الطباعة:', e);
    }
  };

  useEffect(() => {
    // React StrictMode يشغّل effects مرتين أثناء التطوير؛ نمنع تكرار طباعة نفس الوصل.
    const isFinalizedPayment = Boolean(invoice && (isPaid || isPartial || isFree));
    const receiptKey = invoice?.id || invoice?.receiptNumber || '';
    if (isOpen && subscriber && autoPrint && isFinalizedPayment && receiptKey) {
      if (lastAutoPrintedReceiptRef.current === receiptKey) return;
      lastAutoPrintedReceiptRef.current = receiptKey;
      const timer = window.setTimeout(() => handlePrint(), 450);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, subscriber, invoice, autoPrint, isPaid, isPartial, isFree]);

  if (!isOpen || !subscriber) return null;

  const handleWhatsAppShare = () => {
    const text = `*وصل اشتراك مولدة - ${customSettings.headerTitle || generatorSpecs.generatorName}*
المشترك: ${subscriber.fullName}
الكود: ${subscriber.code || subscriber.subscriberCode}
الفترة: ${displayMonth}
الأمبيرات: ${displayAmperes} أمبير
المبلغ: ${isFree ? 'إعفاء مجاني' : formatCurrency(displayAmount)}
الحالة: ${isPaid ? 'تم التسديد بنجاح ✅' : isFree ? 'معفي' : 'يرجى التسديد ⚠️'}
${customSettings.customNoteText || ''}`;

    const phoneNum = subscriber.phone ? subscriber.phone.replace(/^0/, '') : '7800000000';
    const url = `https://api.whatsapp.com/send?phone=964${phoneNum}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto font-['Cairo']" dir="rtl">
      

      <div className="relative w-full max-w-sm bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        
        {/* شريط التحكم العلوي */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            معاينة وصل القبض والطباعة (58 مم)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">واتساب</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!invoice || (!isPaid && !isPartial && !isFree)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-bold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الوصل</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* عرض الوصل بالكامل */}
        <div className="p-6 bg-slate-100 dark:bg-[#080d1a] overflow-y-auto flex justify-center">
          <div
            id="thermal-receipt-printable"
            className="bg-white text-slate-900 rounded-xl p-3 shadow-lg border border-slate-300 space-y-2 w-[260px] text-xs"
          >
            {/* رأس الوصل */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <h2 className="text-xs font-black text-slate-900">
                  {customSettings.headerTitle || generatorSpecs.generatorName}
                </h2>
              </div>
              {customSettings.showGeneratorName && (
                <p className="text-[9px] text-slate-600">{generatorSpecs.location || 'العنوان الرئيسي'}</p>
              )}
              <div className="text-[9px] text-slate-500 mt-0.5 font-mono font-bold">رقم الوصل: {displayReceiptNumber}</div>
            </div>

            {/* تفاصيل الوصل */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between border-b border-slate-100 py-0.5">
                <span className="text-slate-500">اسم المشترك:</span>
                <span className="font-bold text-slate-900">{subscriber.fullName}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 py-0.5">
                <span className="text-slate-500">كود المشترك:</span>
                <span className="font-bold text-slate-900 font-mono" dir="ltr">{subscriber.code || subscriber.subscriberCode || '-'}</span>
              </div>

              {subscriber.phone && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">{subscriber.phone}</span>
                </div>
              )}

              {customSettings.showPhaseName && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">الكابينة / الفيز:</span>
                  <span className="font-bold text-slate-800">{subscriber.line || 'الخط الرئيسي'}</span>
                </div>
              )}

              {customSettings.showAmperesCount && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">عدد الأمبيرات:</span>
                  <span className="font-bold text-blue-700">{formatNumberArabic(displayAmperes)} أمبير</span>
                </div>
              )}

              {customSettings.showAmperesPrice && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">سعر الأمبير:</span>
                  <span className="font-bold text-slate-800">
                    {isFree ? '0 د.ع' : formatCurrency(displayPricePerAmp)}
                  </span>
                </div>
              )}

              {customSettings.showPaymentMonth && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">شهر التسديد:</span>
                  <span className="font-bold text-slate-800">{displayMonth}</span>
                </div>
              )}

              <div className="flex justify-between border-b border-slate-100 py-0.5">
                <span className="text-slate-500">حالة الوصل:</span>
                <span className="font-bold text-slate-900">
                  {isCancelled ? 'ملغي' : isFree ? 'إعفاء مجاني' : isPaid ? 'مدفوع' : isPartial ? 'دفع جزئي' : 'غير مدفوع'}
                </span>
              </div>

              {customSettings.showCollectorName && (
                <div className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="text-slate-500">اسم المحاسب:</span>
                  <span className="font-bold text-slate-800">
                    {currentSession?.collectorName || (currentSession?.role === 'admin' ? 'الإدارة العامة' : 'المحاسب')}
                  </span>
                </div>
              )}
            </div>

            {/* المبالغ والمستحقات */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
              {customSettings.showTotalAmount && (
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-[10px]">المبلغ الكلي:</span>
                  <span className="font-black text-blue-900 text-xs">{isFree ? 'إعفاء مجاني' : formatCurrency(displayAmount)}</span>
                </div>
              )}

              {customSettings.showDueDebt && (
                <div className="pt-1 border-t border-dashed border-slate-200 space-y-0.5 text-[9px]">
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>المبلغ المسدد:</span>
                    <span>{formatCurrency(displayPaidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>الديون المستحقة:</span>
                    <span>{formatCurrency(displayRemainingAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* الملاحظات والتاريخ والباركود */}
            <div className="pt-1.5 border-t border-dashed border-slate-400 text-center space-y-0.5 text-[9px] text-slate-600">
              {customSettings.customNoteText && (
                <p className="font-bold text-slate-800">{customSettings.customNoteText}</p>
              )}
              <p className="text-[8px] text-slate-400 font-mono">تاريخ الإصدار: {displayIssueDate}</p>
              <p className="text-[8px] text-slate-400 font-mono">وقت الطباعة: {new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
              {customSettings.showBarcode && (
                <div className="font-mono font-bold tracking-widest text-[10px] pt-0.5 text-slate-800">
                  ||| | ||| || ||| | ||
                </div>
              )}
            </div>
          </div>
        </div>

        {/* أسفل النافذة: التسديد يتم حصراً من نافذة التسديد، والوصل لا يطبع قبل الحفظ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <span className={`text-xs font-bold ${invoice && (isPaid || isPartial || isFree) ? 'text-emerald-600' : 'text-amber-600'}`}>
            {invoice && (isPaid || isPartial || isFree)
              ? 'الوصل معتمد ويمكن طباعته'
              : 'يجب إكمال التسديد أولاً قبل طباعة الوصل'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer w-full sm:w-auto text-center"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
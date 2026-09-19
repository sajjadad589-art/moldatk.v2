import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import { Subscriber, GeneratorSpecs, SubscriptionTierPricing, SubscriberInvoice } from '../types';
import { formatCurrency, formatNumberArabic } from '../utils/formatters';
import { isNativeAndroid, printSunmiReceipt } from '../utils/sunmiPrinter';
import { ensureSubscriberPortalLink } from '../lib/subscriberPortal';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  generatorSpecs: GeneratorSpecs;
  generatorId?: string | null;
  pricingTiers: SubscriptionTierPricing[];
  onMarkAsPaid: (subId: string) => void;
  autoPrint?: boolean;
  invoice?: SubscriberInvoice | null;
}

const clean = (value?: string | null) => (value || '').trim();

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  generatorSpecs,
  generatorId,
  pricingTiers,
  autoPrint = false,
  invoice = null,
}) => {
  const lastAutoPrintedReceiptRef = useRef('');
  const [printAnimationKey, setPrintAnimationKey] = useState(0);
  const [portalUrl, setPortalUrl] = useState('');
  const [portalQrDataUrl, setPortalQrDataUrl] = useState('');

  const currentTierType = invoice ? invoice.tier : subscriber?.tier;
  const currentTier = pricingTiers.find(p => p.type === currentTierType || p.id === currentTierType);
  const isCancelled = invoice?.status === 'cancelled';
  const isPaid = invoice ? invoice.status === 'paid' : subscriber?.paymentStatus === 'paid';
  const isPartial = invoice ? invoice.status === 'partial' : subscriber?.paymentStatus === 'partial';
  const isFree = invoice ? invoice.status === 'free' : (subscriber?.paymentStatus === 'free' || subscriber?.tier === 'free');

  const amperes = invoice?.amperes ?? subscriber?.amperes ?? 0;
  const pricePerAmp = invoice?.pricePerAmpere ?? currentTier?.pricePerAmpere ?? 0;
  const totalAmount = invoice?.totalAmount ?? subscriber?.amountDue ?? 0;
  const paidAmount = invoice?.paidAmount ?? subscriber?.amountPaid ?? (isPaid ? totalAmount : 0);
  const remainingAmount = invoice?.remainingAmount ?? Math.max(0, totalAmount - paidAmount);
  const paymentAmount = isFree ? 0 : (paidAmount > 0 ? paidAmount : totalAmount);
  const paymentMonth = clean(invoice?.monthNameAr);
  const receiptNumber = clean(invoice?.receiptNumber);
  const issueDate = clean(invoice?.paymentDate || invoice?.issueDate || subscriber?.lastPaymentDate) || new Date().toISOString().split('T')[0];
  const previousDebtBefore = Math.max(0, Number(invoice?.previousDebtBefore || 0));
  const currentCharge = Math.max(0, Number(invoice?.currentCharge ?? invoice?.totalAmount ?? 0));
  const totalBeforePayment = Math.max(0, Number(invoice?.totalBeforePayment ?? (previousDebtBefore + currentCharge)));
  const appliedToPreviousDebt = Math.max(0, Number(invoice?.appliedToPreviousDebt || 0));
  const appliedToCurrentMonth = Math.max(0, Number(invoice?.appliedToCurrentMonth || 0));
  const totalOutstandingAfter = Math.max(0, Number(invoice?.totalOutstandingAfter ?? remainingAmount));
  const generatorName = clean(generatorSpecs.generatorName) || 'المولدة';
  const lineName = clean(subscriber?.lineName || subscriber?.line);
  const phone = clean(subscriber?.phone);

  const finalized = Boolean(invoice && !isFree && (isPaid || isPartial) && Number(invoice.paidAmount || 0) > 0);
  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';

  // WORKMODE_RECEIPT_SIMPLE_DATE_MONTH_REPAIR
  const formatReceiptDate = (value?: string) => {
    const d = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    const datePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(safeDate);
    const timePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: true }).format(safeDate).replace('AM', 'ص').replace('PM', 'م');
    return datePart + '    ' + timePart;
  };
  const formatReceiptMonth = (raw?: string) => {
    const text = clean(raw);
    if (!text) return '';
    const iso = text.match(/(20\d{2})[-\/](\d{1,2})/);
    if (iso) return String(Number(iso[2])) + '-' + iso[1];
    const named = text.match(/شهر\s*(\d{1,2}).*?(20\d{2})/);
    if (named) return String(Number(named[1])) + '-' + named[2];
    return text;
  };
  const displayIssueDate = formatReceiptDate(issueDate);
  const displayPaymentMonth = formatReceiptMonth(paymentMonth || invoice?.monthId);

  // MOLDATK_SUBSCRIBER_PORTAL_QR_V1
  useEffect(() => {
    if (!isOpen || !subscriber?.id || !generatorId) {
      setPortalUrl('');
      setPortalQrDataUrl('');
      return;
    }

    let cancelled = false;
    void ensureSubscriberPortalLink(generatorId, subscriber.id)
      .then(link => {
        if (cancelled) return;
        setPortalUrl(link.url);
        setPortalQrDataUrl(link.qrDataUrl);
      })
      .catch(error => {
        if (!cancelled) console.warn('تعذر تجهيز رابط حساب المشترك للوصول:', error);
      });

    return () => { cancelled = true; };
  }, [isOpen, generatorId, subscriber?.id]);

  const handlePrint = async () => {
    if (!finalized) {
      window.alert(isFree ? 'الحساب المجاني لا يصدر له وصل تسديد.' : 'لا يمكن طباعة الوصل قبل إكمال عملية التسديد وحفظها.');
      return;
    }

    let printPortalUrl = portalUrl;
    let printPortalQrDataUrl = portalQrDataUrl;
    if (generatorId && subscriber?.id && (!printPortalUrl || !printPortalQrDataUrl)) {
      try {
        const link = await ensureSubscriberPortalLink(generatorId, subscriber.id);
        printPortalUrl = link.url;
        printPortalQrDataUrl = link.qrDataUrl;
        setPortalUrl(link.url);
        setPortalQrDataUrl(link.qrDataUrl);
      } catch (error) {
        console.warn('سيتم طباعة الوصل بدون QR لأن رابط المشترك غير متوفر حالياً:', error);
      }
    }

    // MOLDATK_SCREEN_PRINT_MOTION_V2
    // The receipt animation starts only when a real print action starts.
    setPrintAnimationKey(key => key + 1);
    await new Promise<void>(resolve => window.setTimeout(resolve, 700));

    if (isNativeAndroid()) {
      try {
        await printSunmiReceipt({
          header: generatorName,
          receiptNumber,
          subscriberName: subscriber?.fullName || '',
          subscriberCode: '',
          phone,
          lineName,
          amperes: amperes > 0 ? `${formatNumberArabic(amperes)} أمبير` : '',
          pricePerAmp: pricePerAmp > 0 ? formatCurrency(pricePerAmp) : '',
          month: displayPaymentMonth,
          status: statusText,
          totalAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),
          paidAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),
          remainingAmount: totalOutstandingAfter > 0 ? formatCurrency(totalOutstandingAfter) : '',
          previousDebt: previousDebtBefore > 0 ? formatCurrency(previousDebtBefore) : '',
          currentCharge: formatCurrency(currentCharge),
          totalBeforePayment: formatCurrency(totalBeforePayment),
          appliedToPreviousDebt: '',
          appliedToCurrentMonth: appliedToCurrentMonth > 0 ? formatCurrency(appliedToCurrentMonth) : '',
          totalOutstandingAfter: totalOutstandingAfter > 0 ? formatCurrency(totalOutstandingAfter) : '0 د.ع',
          note: '',
          issueDate: displayIssueDate,
          printTime: new Date().toLocaleTimeString('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
          portalUrl: printPortalUrl,
          qrDataUrl: printPortalQrDataUrl,
        });
        return;
      } catch (error) {
        console.error('تعذر استخدام طابعة SUNMI، سيتم استخدام طباعة المتصفح:', error);
      }
    }

    if (printPortalQrDataUrl && printPortalQrDataUrl !== portalQrDataUrl) {
      await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    }

    const receipt = document.getElementById('thermal-receipt-printable');
    if (!receipt) return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '58mm';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    try {
      const frameWindow = iframe.contentWindow;
      const frameDocument = iframe.contentDocument || frameWindow?.document;
      if (!frameWindow || !frameDocument) return;

      frameDocument.open();
      frameDocument.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8" />
<style>
@page{size:58mm auto;margin:0!important}html,body{width:58mm!important;margin:0!important;padding:0!important;background:#fff!important;color:#000!important}body{font-family:Arial,Tahoma,sans-serif!important;direction:rtl!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}#thermal-receipt-printable{width:56mm!important;margin:4mm 1mm 1.5mm!important;padding:4.5mm 1.7mm 3mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:2px solid #000!important;border-radius:7px!important;box-shadow:none!important;font-size:12px!important;line-height:1.42!important}#thermal-receipt-printable *{box-sizing:border-box!important;color:#000!important;font-weight:900!important;text-shadow:none!important;filter:none!important;-webkit-font-smoothing:none!important}#thermal-receipt-printable .receipt-generator{font-size:20px!important;font-weight:900!important;border:2px solid #000!important;padding:7px 4px!important;border-radius:8px!important}#thermal-receipt-printable .receipt-title{font-size:15px!important;font-weight:900!important}#thermal-receipt-printable .receipt-name{font-size:17px!important;font-weight:900!important}#thermal-receipt-printable .receipt-payment{font-size:16px!important;font-weight:900!important}#thermal-receipt-printable .receipt-total{font-size:14px!important;font-weight:900!important;border:2px solid #000!important;padding:6px 4px!important}#thermal-receipt-printable .receipt-total .receipt-amount{font-size:22px!important;line-height:1.15!important}#thermal-receipt-printable .receipt-brand{font-size:20px!important;font-weight:900!important}.receipt-logo{width:12mm!important;height:12mm!important;object-fit:contain!important;display:block!important;margin:0 auto!important}.receipt-system-name{font-size:20px!important;font-weight:900!important}#thermal-receipt-printable svg{display:none!important}.receipt-row{display:flex!important;justify-content:space-between!important;gap:8px!important;padding:4px 0!important;border-bottom:1px dotted #777!important}.receipt-label{font-weight:900!important;color:#000!important}.receipt-value{font-weight:900!important;color:#000!important;text-align:left!important}.receipt-divider{border-top:1px dashed #000!important;margin:7px 0!important}.receipt-qr{display:block!important;width:27mm!important;height:27mm!important;object-fit:contain!important;margin:2mm auto 1mm!important}.receipt-portal-url{font-size:7px!important;direction:ltr!important;word-break:break-all!important;text-align:center!important}.receipt-hide-print{display:none!important}
</style></head><body>${receipt.outerHTML}</body></html>`);
      frameDocument.close();

      window.setTimeout(() => {
        const printed = frameDocument.getElementById('thermal-receipt-printable');
        if (!printed) return;
        const pxHeight = Math.ceil(printed.scrollHeight || printed.getBoundingClientRect().height);
        const heightMm = Math.max(40, Math.ceil((pxHeight * 25.4) / 96));
        const style = frameDocument.createElement('style');
        style.textContent = `@page{size:58mm ${heightMm}mm;margin:0!important}html,body{height:${heightMm}mm!important}`;
        frameDocument.head.appendChild(style);
        iframe.style.height = `${pxHeight}px`;
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(() => iframe.remove(), 1200);
      }, 180);
    } catch (error) {
      console.error('فشل إرسال أمر الطباعة:', error);
      iframe.remove();
    }
  };

  useEffect(() => {
    const receiptKey = invoice?.id || invoice?.receiptNumber || '';
    if (!isOpen || !subscriber || !autoPrint || !finalized || !receiptKey) return;
    if (lastAutoPrintedReceiptRef.current === receiptKey) return;
    lastAutoPrintedReceiptRef.current = receiptKey;
    const timer = window.setTimeout(() => { void handlePrint(); }, 220);
    return () => window.clearTimeout(timer);
  }, [isOpen, subscriber, invoice, autoPrint, finalized]);

  if (!isOpen || !subscriber) return null;

  const handleWhatsAppShare = () => {
    if (!finalized || isFree) return;
    const rows = [
      `*${generatorName}*`,
      `اسم المشترك: ${subscriber.fullName}`,
      displayPaymentMonth ? `شهر التسديد: ${displayPaymentMonth}` : '',
      pricePerAmp > 0 ? `سعر الأمبير الشهري: ${formatCurrency(pricePerAmp)}` : '',
      previousDebtBefore > 0 ? `دين سابق: ${formatCurrency(previousDebtBefore)}` : '',
      `استحقاق الشهر الحالي: ${formatCurrency(currentCharge)}`,
      `الإجمالي قبل التسديد: ${formatCurrency(totalBeforePayment)}`,
      `المبلغ المستلم: ${formatCurrency(paymentAmount)}`,
      appliedToCurrentMonth > 0 ? `تسديد الشهر الحالي: ${formatCurrency(appliedToCurrentMonth)}` : '',
      `المتبقي بعد التسديد: ${formatCurrency(totalOutstandingAfter)}` ,
      `التاريخ: ${displayIssueDate}`,
      `الحالة: ${statusText}`,
      portalUrl ? `متابعة الحساب: ${portalUrl}` : '',
      '',
      '*مولدتك*',
    ].filter(Boolean).join('\n');
    const phoneNum = phone ? phone.replace(/^0/, '') : '';
    const url = phoneNum
      ? `https://api.whatsapp.com/send?phone=964${phoneNum}&text=${encodeURIComponent(rows)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(rows)}`;
    window.open(url, '_blank');
  };

  const Row = ({ label, value, strong = false }: { label: string; value?: React.ReactNode; strong?: boolean }) => {
    if (value === undefined || value === null || value === '') return null;
    return <div className="receipt-row flex justify-between gap-3 py-1.5 border-b border-dotted border-black font-black text-black"><span className="receipt-label text-black font-black">{label}</span><span className={`receipt-value text-left text-black font-black ${strong ? 'text-sm' : ''}`}>{value}</span></div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto font-['Cairo']" dir="rtl">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">معاينة إيصال التسديد 58 مم</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleWhatsAppShare} disabled={!finalized} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="مشاركة الوصل"><Share2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => void handlePrint()} disabled={!finalized} className="px-3 py-2 rounded-lg bg-[#0B1F3B] text-white disabled:bg-slate-300 disabled:text-black text-xs font-black flex items-center gap-1.5"><Printer className="w-4 h-4" />طباعة</button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-black hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 bg-slate-100 dark:bg-[#080d1a] overflow-y-auto flex justify-center">
          <div
            key={printAnimationKey}
            id="thermal-receipt-printable"
            className={`bg-white text-black font-black rounded-xl px-3 pt-7 pb-5 shadow-lg border-2 border-black w-[260px] text-xs ${autoPrint && printAnimationKey === 0 ? 'receipt-awaiting-print' : ''} ${printAnimationKey > 0 ? 'receipt-screen-printing' : ''}`}
          >
            {/* MOLDATK_RECEIPT_BRAND_HEADER_V1 */}
            <div className="receipt-system-brand text-center pb-2">
              <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="receipt-logo mx-auto w-12 h-12 object-contain" />
              <div className="receipt-system-name text-xl font-black leading-none mt-1">مولدتك</div>
            </div>
            <div className="receipt-generator text-center text-base font-black border-2 border-slate-950 rounded-lg px-2 py-2">{generatorName}</div>
<Row label="التاريخ" value={displayIssueDate} strong />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            <div className="py-1">
              <div className="text-[10px] font-black text-black">اسم المشترك</div>
              <div className="receipt-name text-lg font-black text-black leading-tight mt-0.5 tracking-tight">{subscriber.fullName}</div>
            </div>
            {phone && <Row label="رقم الهاتف" value={<span dir="ltr">{phone}</span>} />}
            {lineName && <Row label="الكابينة" value={lineName} />}
            {amperes > 0 && <Row label="عدد الأمبيرات" value={`${formatNumberArabic(amperes)} أمبير`} />}
            {pricePerAmp > 0 && <Row label="سعر الأمبير الشهري" value={formatCurrency(pricePerAmp)} strong />}
            {displayPaymentMonth && <Row label="شهر التسديد" value={displayPaymentMonth} strong />}
            <Row label="حالة التسديد" value={statusText} />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            {previousDebtBefore > 0 && <Row label="الدين السابق" value={formatCurrency(previousDebtBefore)} strong />}
            <Row label="استحقاق الشهر الحالي" value={formatCurrency(currentCharge)} strong />
            <Row label="الإجمالي قبل التسديد" value={formatCurrency(totalBeforePayment)} strong />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            {appliedToCurrentMonth > 0 && <Row label="تسديد الشهر الحالي" value={formatCurrency(appliedToCurrentMonth)} />}
            <Row label="المتبقي بعد التسديد" value={formatCurrency(totalOutstandingAfter)} strong />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            <div className="receipt-total text-center border-2 border-slate-950 rounded-lg py-2 px-1">
              <div className="text-[10px] font-black mb-0.5">المبلغ المستلم</div>
              <div className="receipt-amount text-xl font-black tracking-tight leading-tight">{formatCurrency(paymentAmount)}</div>
            </div>

            <div className="text-center text-[10px] font-black py-3">شكراً لتسديدكم</div>
            {portalQrDataUrl && portalUrl && (
              <>
                <div className="receipt-divider border-t border-dashed border-slate-500 mb-2" />
                <div className="text-center text-[9px] font-black">امسح الرمز لمتابعة حسابك</div>
                <img src={portalQrDataUrl} alt="QR حساب المشترك" className="receipt-qr w-28 h-28 object-contain mx-auto my-2" />
                <div className="receipt-portal-url text-[7px] font-black text-center break-all" dir="ltr">{portalUrl}</div>
              </>
            )}
            <div className="receipt-divider border-t border-dashed border-slate-500 mb-2" />
            <div className="text-center text-[8px] font-black text-black mt-1">نظام إدارة المولدات والجباية</div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center">
          <span className={`text-xs font-black ${finalized ? 'text-emerald-600' : 'text-amber-600'}`}>{finalized ? 'الوصل معتمد وجاهز للطباعة' : 'أكمل التسديد أولاً حتى تتفعل الطباعة'}</span>
        </div>
      </div>
    </div>
  );
};

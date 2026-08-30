import React, { useEffect, useRef } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
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

const clean = (value?: string | null) => (value || '').trim();

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  generatorSpecs,
  pricingTiers,
  autoPrint = false,
  invoice = null,
}) => {
  const lastAutoPrintedReceiptRef = useRef('');

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
  const generatorName = clean(generatorSpecs.generatorName) || 'المولدة';
  const lineName = clean(subscriber?.lineName || subscriber?.line);
  const phone = clean(subscriber?.phone);

  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));
  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';

  const handlePrint = async () => {
    if (!finalized) {
      window.alert('لا يمكن طباعة الوصل قبل إكمال عملية التسديد وحفظها.');
      return;
    }

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
          month: paymentMonth,
          status: statusText,
          totalAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),
          paidAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),
          remainingAmount: remainingAmount > 0 ? formatCurrency(remainingAmount) : '',
          note: '',
          issueDate,
          printTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      } catch (error) {
        console.error('تعذر استخدام طابعة SUNMI، سيتم استخدام طباعة المتصفح:', error);
      }
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
@page{size:58mm auto;margin:0!important}html,body{width:58mm!important;margin:0!important;padding:0!important;background:#fff!important;color:#000!important}body{font-family:Arial,Tahoma,sans-serif!important;direction:rtl!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}#thermal-receipt-printable{width:56mm!important;margin:0 1mm!important;padding:1.5mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:12px!important;line-height:1.35!important}#thermal-receipt-printable *{box-sizing:border-box!important;color:#000!important;text-shadow:none!important;filter:none!important}#thermal-receipt-printable .receipt-generator{font-size:20px!important;font-weight:900!important;border:2px solid #000!important;padding:7px 4px!important;border-radius:8px!important}#thermal-receipt-printable .receipt-title{font-size:15px!important;font-weight:900!important}#thermal-receipt-printable .receipt-name{font-size:17px!important;font-weight:900!important}#thermal-receipt-printable .receipt-payment{font-size:16px!important;font-weight:900!important}#thermal-receipt-printable .receipt-total{font-size:26px!important;font-weight:900!important;border:2px solid #000!important;padding:8px 4px!important}#thermal-receipt-printable .receipt-brand{font-size:20px!important;font-weight:900!important}#thermal-receipt-printable svg{display:none!important}.receipt-row{display:flex!important;justify-content:space-between!important;gap:8px!important;padding:4px 0!important;border-bottom:1px dotted #777!important}.receipt-label{font-weight:700!important}.receipt-value{font-weight:900!important;text-align:left!important}.receipt-divider{border-top:1px dashed #000!important;margin:7px 0!important}.receipt-hide-print{display:none!important}
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
    const timer = window.setTimeout(() => { void handlePrint(); }, 450);
    return () => window.clearTimeout(timer);
  }, [isOpen, subscriber, invoice, autoPrint, finalized]);

  if (!isOpen || !subscriber) return null;

  const handleWhatsAppShare = () => {
    const rows = [
      `*إيصال تسديد - ${generatorName}*`,
      `اسم المشترك: ${subscriber.fullName}`,
      paymentMonth ? `شهر التسديد: ${paymentMonth}` : '',
      pricePerAmp > 0 ? `سعر الأمبير الشهري: ${formatCurrency(pricePerAmp)}` : '',
      `مبلغ التسديد: ${isFree ? 'مجاني' : formatCurrency(paymentAmount)}`,
      `التاريخ: ${issueDate}`,
      `الحالة: ${statusText}`,
      '',
      '*مولدتي*',
    ].filter(Boolean).join('\n');
    const phoneNum = phone ? phone.replace(/^0/, '') : '';
    const url = phoneNum
      ? `https://api.whatsapp.com/send?phone=964${phoneNum}&text=${encodeURIComponent(rows)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(rows)}`;
    window.open(url, '_blank');
  };

  const Row = ({ label, value, strong = false }: { label: string; value?: React.ReactNode; strong?: boolean }) => {
    if (value === undefined || value === null || value === '') return null;
    return <div className="receipt-row flex justify-between gap-3 py-1.5 border-b border-dotted border-slate-300"><span className="receipt-label text-slate-600 font-bold">{label}</span><span className={`receipt-value text-left text-slate-950 ${strong ? 'font-black text-sm' : 'font-bold'}`}>{value}</span></div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto font-['Cairo']" dir="rtl">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">معاينة إيصال التسديد 58 مم</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleWhatsAppShare} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600" aria-label="مشاركة الوصل"><Share2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => void handlePrint()} disabled={!finalized} className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:bg-slate-300 disabled:text-slate-500 text-xs font-black flex items-center gap-1.5"><Printer className="w-4 h-4" />طباعة</button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 bg-slate-100 dark:bg-[#080d1a] overflow-y-auto flex justify-center">
          <div id="thermal-receipt-printable" className="bg-white text-slate-950 rounded-xl p-3 shadow-lg border border-slate-300 w-[260px] text-xs">
            <div className="receipt-generator text-center text-xl font-black border-2 border-slate-950 rounded-lg px-2 py-2.5">{generatorName}</div>
            <div className="receipt-title text-center text-base font-black py-3 border-b border-dashed border-slate-500">إيصال تسديد</div>

            {receiptNumber && <Row label="رقم الإيصال" value={receiptNumber} />}
            <Row label="التاريخ" value={issueDate} strong />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            <div className="py-1">
              <div className="text-[10px] font-bold text-slate-500">اسم المشترك</div>
              <div className="receipt-name text-lg font-black text-slate-950 leading-tight mt-0.5">{subscriber.fullName}</div>
            </div>
            {phone && <Row label="رقم الهاتف" value={<span dir="ltr">{phone}</span>} />}
            {lineName && <Row label="الكابينة" value={lineName} />}
            {amperes > 0 && <Row label="عدد الأمبيرات" value={`${formatNumberArabic(amperes)} أمبير`} />}
            {pricePerAmp > 0 && <Row label="سعر الأمبير الشهري" value={formatCurrency(pricePerAmp)} strong />}
            {paymentMonth && <Row label="شهر التسديد" value={paymentMonth} strong />}
            <Row label="حالة التسديد" value={statusText} />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            <div className="py-1.5">
              <div className="text-[10px] font-bold text-slate-500">مبلغ التسديد</div>
              <div className="receipt-payment text-lg font-black mt-0.5">{isFree ? 'مجاني' : formatCurrency(paymentAmount)}</div>
            </div>
            {remainingAmount > 0 && <Row label="المتبقي" value={formatCurrency(remainingAmount)} />}

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            <div className="receipt-total text-center border-2 border-slate-950 rounded-lg py-2 px-1">
              <div className="text-[10px] font-black mb-0.5">المبلغ النهائي</div>
              <div className="text-2xl font-black tracking-tight">{isFree ? 'مجاني' : formatCurrency(paymentAmount)}</div>
            </div>

            <div className="text-center text-[10px] font-bold py-3">شكراً لتسديدكم</div>
            <div className="receipt-divider border-t border-dashed border-slate-500 mb-2" />
            <div className="receipt-brand text-center text-xl font-black leading-none">مولدتي</div>
            <div className="text-center text-[8px] font-bold text-slate-500 mt-1">نظام إدارة المولدات والجباية</div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center">
          <span className={`text-xs font-bold ${finalized ? 'text-emerald-600' : 'text-amber-600'}`}>{finalized ? 'الوصل معتمد وجاهز للطباعة' : 'أكمل التسديد أولاً حتى تتفعل الطباعة'}</span>
        </div>
      </div>
    </div>
  );
};

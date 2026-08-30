import fs from 'node:fs';

const file = 'src/CollectorApp.tsx';
let src = fs.readFileSync(file, 'utf8');

const importNeedle = "import { calculateSubscriberBill } from './utils/formatters';\n";
const importLine = "import { isNativeAndroid, printSunmiReceipt } from './utils/sunmiPrinter';\n";
if (!src.includes(importLine)) {
  if (!src.includes(importNeedle)) throw new Error('CollectorApp import anchor not found');
  src = src.replace(importNeedle, importNeedle + importLine);
}

const oldBlock = `  const handleMarkAsPaid = (subId: string) => {
    const updated = subscribers.map(sub => {
      if (sub.id === subId) {
        const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
        return {
          ...sub,
          paymentStatus: 'paid' as const,
          amountPaid: calc.total,
          amountDue: 0,
          lastPaymentDate: new Date().toISOString().split('T')[0],
        };
      }
      return sub;
    });
    saveSubscribersToStorage(updated);
    showToast('تم تسجيل التسديد وطباعة الوصل بنجاح');

    setTimeout(() => window.print(), 300);
  };`;

const newBlock = `  const printCollectorReceipt = async (sub: Subscriber) => {
    const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
    const total = sub.amountPaid || calc.total;
    const code = sub.code || sub.subscriberCode || '-';
    const receiptNumber = 'REC-' + code + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const issueDate = new Date().toISOString().split('T')[0];
    const lineName = sub.lineName || sub.line || '-';
    const pricePerAmp = sub.amperes > 0 ? Math.round(total / sub.amperes) : 0;

    if (isNativeAndroid()) {
      await printSunmiReceipt({
        header: generatorName || 'مولدتك',
        receiptNumber,
        subscriberName: sub.fullName || '-',
        subscriberCode: code,
        phone: sub.phone || '',
        lineName,
        amperes: String(sub.amperes) + ' أمبير',
        pricePerAmp: formatCurrencyEn(pricePerAmp),
        month: new Date().toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' }),
        status: 'مدفوع',
        collector: userSession?.collectorName || 'الجابي',
        totalAmount: formatCurrencyEn(total),
        paidAmount: formatCurrencyEn(total),
        remainingAmount: '0 د.ع',
        note: 'شكراً لتسديدكم، يرجى الاحتفاظ بالوصل.',
        issueDate,
        printTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      });
      return;
    }

    const esc = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = '58mm';
    frame.style.height = '1px';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    const win = frame.contentWindow;
    if (!doc || !win) { frame.remove(); return; }

    const html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>' +
      '@page{size:58mm auto;margin:0}' +
      'html,body{width:58mm;margin:0!important;padding:0!important;background:#fff;color:#000}' +
      'body{font-family:Arial,Tahoma,sans-serif;font-weight:700;direction:rtl}' +
      '.r{width:56mm;margin:0 1mm;padding:1.5mm 1.5mm 1mm;box-sizing:border-box;font-size:13px;line-height:1.35;color:#000}' +
      '.title{text-align:center;font-size:20px;font-weight:900;margin:0 0 1mm}' +
      '.sub{text-align:center;font-size:12px;font-weight:800;margin:0 0 1.5mm}' +
      '.sep{border-top:1.5px dashed #000;margin:1.5mm 0}' +
      '.row{display:flex;justify-content:space-between;gap:2mm;margin:.8mm 0;align-items:flex-start}' +
      '.row span:first-child{font-weight:900;white-space:nowrap}.row span:last-child{text-align:left;word-break:break-word}' +
      '.amount{text-align:center;font-size:22px;font-weight:900;margin:1.2mm 0}' +
      '.footer{text-align:center;font-size:11px;font-weight:800;margin-top:1.5mm}' +
      '*{box-sizing:border-box;color:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '</style></head><body><div class="r">' +
      '<div class="title">' + esc(generatorName || 'مولدتك') + '</div>' +
      '<div class="sub">وصل قبض • ' + esc(receiptNumber) + '</div>' +
      '<div class="sep"></div>' +
      '<div class="row"><span>اسم المشترك</span><span>' + esc(sub.fullName || '-') + '</span></div>' +
      '<div class="row"><span>كود المشترك</span><span>' + esc(code) + '</span></div>' +
      '<div class="row"><span>الكابينة / الخط</span><span>' + esc(lineName) + '</span></div>' +
      '<div class="row"><span>عدد الأمبيرات</span><span>' + esc(sub.amperes) + ' أمبير</span></div>' +
      '<div class="row"><span>سعر الأمبير</span><span>' + esc(formatCurrencyEn(pricePerAmp)) + '</span></div>' +
      '<div class="row"><span>الحالة</span><span>مدفوع</span></div>' +
      '<div class="row"><span>الجابي</span><span>' + esc(userSession?.collectorName || '-') + '</span></div>' +
      '<div class="sep"></div><div class="sub">المبلغ الكلي</div>' +
      '<div class="amount">' + esc(formatCurrencyEn(total)) + '</div>' +
      '<div class="row"><span>المسدد</span><span>' + esc(formatCurrencyEn(total)) + '</span></div>' +
      '<div class="row"><span>المتبقي</span><span>0 د.ع</span></div>' +
      '<div class="sep"></div><div class="footer">شكراً لتسديدكم • ' + esc(issueDate) + '</div>' +
      '</div></body></html>';

    doc.open();
    doc.write(html);
    doc.close();

    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(() => frame.remove(), 1200);
    }, 200);
  };

  const handleMarkAsPaid = async (subId: string) => {
    const updated = subscribers.map(sub => {
      if (sub.id === subId) {
        const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
        return {
          ...sub,
          paymentStatus: 'paid' as const,
          amountPaid: calc.total,
          amountDue: 0,
          lastPaymentDate: new Date().toISOString().split('T')[0],
        };
      }
      return sub;
    });
    saveSubscribersToStorage(updated);
    const paidSub = updated.find(sub => sub.id === subId);
    if (paidSub) {
      setSelectedSub(paidSub);
      setIsReceiptOpen(true);
      try {
        await printCollectorReceipt(paidSub);
        showToast('تم تسجيل التسديد وطباعة نسخة واحدة من الوصل');
      } catch (error) {
        console.error('Receipt print failed:', error);
        showToast('تم تسجيل التسديد، وتعذرت الطباعة. استخدم زر طباعة من الوصل.');
      }
    } else {
      showToast('تم تسجيل التسديد بنجاح');
    }
  };`;

if (src.includes(oldBlock)) {
  src = src.replace(oldBlock, newBlock);
} else if (!src.includes('const printCollectorReceipt = async')) {
  throw new Error('CollectorApp payment block anchor not found');
}

src = src.replace(
  '<button onClick={() => window.print()} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">طباعة</button>',
  '<button onClick={() => { if (selectedSub) void printCollectorReceipt(selectedSub); }} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">طباعة</button>'
);

fs.writeFileSync(file, src);
console.log('Receipt printing fix applied');

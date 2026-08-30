import fs from 'node:fs';

const file = 'src/components/InvoiceReceiptModal.tsx';
let src = fs.readFileSync(file, 'utf8');

const start = src.indexOf("    const receipt = document.getElementById('thermal-receipt-printable');");
const endMarker = "    } catch (e) {\n      console.error('فشل إرسال أمر الطباعة:', e);\n    }\n";
const end = src.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  if (src.includes('data-browser-receipt-v2')) {
    console.log('Browser receipt width fix already applied');
    process.exit(0);
  }
  throw new Error('Invoice browser print block not found');
}

const replacement = `    try {
      const esc = (value: unknown) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');

      const statusText = isCancelled
        ? 'ملغي'
        : isFree
          ? 'إعفاء مجاني'
          : isPaid
            ? 'مدفوع'
            : isPartial
              ? 'دفع جزئي'
              : 'غير مدفوع';

      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.position = 'fixed';
      frame.style.left = '-10000px';
      frame.style.top = '0';
      frame.style.width = '58mm';
      frame.style.height = '1px';
      frame.style.border = '0';
      document.body.appendChild(frame);

      const frameWindow = frame.contentWindow;
      const frameDocument = frame.contentDocument || frameWindow?.document;
      if (!frameWindow || !frameDocument) {
        frame.remove();
        return;
      }

      frameDocument.open();
      frameDocument.write(\`<!doctype html>
<html dir="rtl" data-browser-receipt-v2>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: 58mm auto; margin: 0 !important; }
  html, body {
    width: 58mm !important;
    min-width: 58mm !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
  }
  body {
    direction: rtl !important;
    font-family: Arial, Tahoma, sans-serif !important;
    font-weight: 700 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .receipt {
    width: 58mm !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 1.5mm 2.2mm 1mm !important;
    box-sizing: border-box !important;
    color: #000 !important;
    background: #fff !important;
    font-size: 15px !important;
    line-height: 1.32 !important;
    font-weight: 700 !important;
  }
  .brand { text-align:center; font-size:22px; line-height:1.1; font-weight:900; margin:0 0 .8mm; }
  .location { text-align:center; font-size:13px; font-weight:700; margin:0 0 .7mm; }
  .receipt-no { text-align:center; font-size:12px; font-weight:800; direction:ltr; margin-bottom:1.3mm; }
  .sep { border-top:1.5px dashed #000; margin:1.2mm 0; }
  .row { display:flex; width:100%; justify-content:space-between; align-items:flex-start; gap:2mm; padding:.75mm 0; border-bottom:.35px solid #999; }
  .label { font-size:14px; font-weight:800; white-space:nowrap; }
  .value { font-size:15px; font-weight:900; text-align:left; max-width:33mm; overflow-wrap:anywhere; }
  .amount-label { text-align:center; font-size:14px; font-weight:900; margin-top:1mm; }
  .amount { text-align:center; font-size:25px; line-height:1.15; font-weight:900; margin:.8mm 0 1.2mm; }
  .note { text-align:center; font-size:12px; font-weight:800; margin:1.2mm 0 .7mm; }
  .meta { display:flex; justify-content:space-between; gap:2mm; font-size:11px; font-weight:700; margin-top:.8mm; direction:rtl; }
  * { box-sizing:border-box; color:#000 !important; text-shadow:none !important; filter:none !important; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="brand">⚡ \\${esc(customSettings.headerTitle || generatorSpecs.generatorName || 'مولدتك')}</div>
    <div class="location">\\${esc(generatorSpecs.location || 'العنوان الرئيسي')}</div>
    <div class="receipt-no">\\${esc(displayReceiptNumber)}</div>
    <div class="sep"></div>
    <div class="row"><span class="label">اسم المشترك</span><span class="value">\\${esc(subscriber?.fullName || '-')}</span></div>
    <div class="row"><span class="label">كود المشترك</span><span class="value" dir="ltr">\\${esc(subscriber?.code || subscriber?.subscriberCode || '-')}</span></div>
    \\${subscriber?.phone ? \`<div class="row"><span class="label">رقم الهاتف</span><span class="value" dir="ltr">\\${esc(subscriber.phone)}</span></div>\` : ''}
    <div class="row"><span class="label">الكابينة / الفيز</span><span class="value">\\${esc((subscriber as any)?.lineName || (subscriber as any)?.line || 'الخط الرئيسي')}</span></div>
    <div class="row"><span class="label">عدد الأمبيرات</span><span class="value">\\${esc(displayAmperes)} أمبير</span></div>
    <div class="row"><span class="label">سعر الأمبير</span><span class="value">\\${esc(isFree ? '0 د.ع' : formatCurrency(displayPricePerAmp))}</span></div>
    <div class="row"><span class="label">شهر التسديد</span><span class="value">\\${esc(displayMonth)}</span></div>
    <div class="row"><span class="label">حالة الوصل</span><span class="value">\\${esc(statusText)}</span></div>
    <div class="row"><span class="label">اسم المحاسب</span><span class="value">\\${esc(invoice?.collectorName || currentSession?.collectorName || (currentSession?.role === 'admin' ? 'الإدارة العامة' : 'المحاسب'))}</span></div>
    <div class="sep"></div>
    <div class="amount-label">المبلغ الكلي</div>
    <div class="amount">\\${esc(isFree ? 'إعفاء مجاني' : formatCurrency(displayAmount))}</div>
    <div class="row"><span class="label">المبلغ المسدد</span><span class="value">\\${esc(formatCurrency(displayPaidAmount))}</span></div>
    <div class="row"><span class="label">المتبقي</span><span class="value">\\${esc(formatCurrency(displayRemainingAmount))}</span></div>
    <div class="sep"></div>
    \\${customSettings.customNoteText ? \`<div class="note">\\${esc(customSettings.customNoteText)}</div>\` : ''}
    <div class="meta"><span>\\${esc(displayIssueDate)}</span><span>\\${esc(new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }))}</span></div>
  </div>
</body>
</html>\`);
      frameDocument.close();

      window.setTimeout(() => {
        frame.style.height = Math.max(frameDocument.body.scrollHeight, 1) + 'px';
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(() => frame.remove(), 1500);
      }, 300);
    } catch (e) {
      console.error('فشل إرسال أمر الطباعة:', e);
    }
`;

src = src.slice(0, start) + replacement + src.slice(end + endMarker.length);
fs.writeFileSync(file, src);
console.log('Browser receipt 58mm full-width fix applied');

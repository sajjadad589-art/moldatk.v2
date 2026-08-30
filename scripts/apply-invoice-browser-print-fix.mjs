import fs from 'node:fs';

const file = 'src/components/InvoiceReceiptModal.tsx';
let src = fs.readFileSync(file, 'utf8');

const pattern = /    const receipt = document\.getElementById\('thermal-receipt-printable'\);[\s\S]*?\n  };\n\n  useEffect/;

const replacement = `    // Chrome / portable thermal printers: build a dedicated one-page 58mm receipt.
    // Android print services do not reliably support \"auto\" page height and may shrink
    // an HTML card into the middle of the roll. A fixed thermal page removes that scaling.
    const esc = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');

    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '58mm';
      iframe.style.height = '112mm';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      const frameDocument = iframe.contentDocument || frameWindow?.document;
      if (!frameWindow || !frameDocument) {
        iframe.remove();
        return;
      }

      const statusText = isCancelled
        ? 'ملغي'
        : isFree
          ? 'إعفاء مجاني'
          : isPaid
            ? 'مدفوع'
            : isPartial
              ? 'دفع جزئي'
              : 'غير مدفوع';

      const lineName = (subscriber as any)?.lineName || (subscriber as any)?.line || 'الخط الرئيسي';
      const collectorName = invoice?.collectorName || currentSession?.collectorName || (currentSession?.role === 'admin' ? 'الإدارة العامة' : 'المحاسب');
      const html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>' +
        '@page{size:58mm 112mm;margin:0!important}' +
        'html,body{width:58mm!important;height:112mm!important;min-width:58mm!important;max-width:58mm!important;margin:0!important;padding:0!important;background:#fff!important;color:#000!important;overflow:hidden!important}' +
        'body{font-family:Arial,Tahoma,sans-serif!important;direction:rtl!important;font-weight:700!important}' +
        '.receipt{width:58mm!important;height:auto!important;margin:0!important;padding:2mm 2.2mm 1mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;font-size:15px!important;line-height:1.28!important}' +
        '.title{text-align:center;font-size:22px!important;font-weight:900!important;line-height:1.1;margin:0 0 .7mm}' +
        '.location{text-align:center;font-size:13px!important;font-weight:800!important;margin:0 0 .7mm}' +
        '.recno{text-align:center;font-size:12px!important;font-weight:800!important;direction:ltr;margin:0 0 1mm}' +
        '.sep{border-top:1.5px dashed #000;margin:1.1mm 0}' +
        '.row{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:2mm!important;margin:.65mm 0!important;width:100%!important}' +
        '.label{font-weight:900!important;white-space:nowrap!important}.value{font-weight:800!important;text-align:left!important;max-width:33mm!important;word-break:break-word!important}' +
        '.total-label{text-align:center;font-size:15px!important;font-weight:900!important;margin:.7mm 0 0}' +
        '.total{text-align:center;font-size:25px!important;font-weight:900!important;line-height:1.05;margin:.5mm 0 1mm}' +
        '.note{text-align:center;font-size:12px!important;font-weight:800!important;line-height:1.25;margin:1mm 0 .6mm}' +
        '.meta{text-align:center;font-size:10.5px!important;font-weight:700!important;margin:.25mm 0}' +
        '*{box-sizing:border-box!important;color:#000!important;opacity:1!important;text-shadow:none!important;filter:none!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        '</style></head><body><div class="receipt">' +
        '<div class="title">' + esc(customSettings.headerTitle || generatorSpecs.generatorName || 'مولدتك') + '</div>' +
        (generatorSpecs.location ? '<div class="location">' + esc(generatorSpecs.location) + '</div>' : '') +
        '<div class="recno">' + esc(displayReceiptNumber) + '</div>' +
        '<div class="sep"></div>' +
        '<div class="row"><span class="label">اسم المشترك</span><span class="value">' + esc(subscriber.fullName || '-') + '</span></div>' +
        '<div class="row"><span class="label">كود المشترك</span><span class="value" dir="ltr">' + esc(subscriber.code || subscriber.subscriberCode || '-') + '</span></div>' +
        (subscriber.phone ? '<div class="row"><span class="label">رقم الهاتف</span><span class="value" dir="ltr">' + esc(subscriber.phone) + '</span></div>' : '') +
        '<div class="row"><span class="label">الكابينة / الخط</span><span class="value">' + esc(lineName) + '</span></div>' +
        '<div class="row"><span class="label">عدد الأمبيرات</span><span class="value">' + esc(displayAmperes) + ' أمبير</span></div>' +
        '<div class="row"><span class="label">سعر الأمبير</span><span class="value">' + esc(isFree ? '0 د.ع' : formatCurrency(displayPricePerAmp)) + '</span></div>' +
        '<div class="row"><span class="label">شهر التسديد</span><span class="value">' + esc(displayMonth) + '</span></div>' +
        '<div class="row"><span class="label">حالة الوصل</span><span class="value">' + esc(statusText) + '</span></div>' +
        '<div class="row"><span class="label">اسم الجابي</span><span class="value">' + esc(collectorName) + '</span></div>' +
        '<div class="sep"></div>' +
        '<div class="total-label">المبلغ الكلي</div>' +
        '<div class="total">' + esc(isFree ? 'إعفاء مجاني' : formatCurrency(displayAmount)) + '</div>' +
        '<div class="row"><span class="label">المبلغ المسدد</span><span class="value">' + esc(formatCurrency(displayPaidAmount)) + '</span></div>' +
        '<div class="row"><span class="label">المتبقي</span><span class="value">' + esc(formatCurrency(displayRemainingAmount)) + '</span></div>' +
        '<div class="sep"></div>' +
        (customSettings.customNoteText ? '<div class="note">' + esc(customSettings.customNoteText) + '</div>' : '') +
        '<div class="meta">' + esc(displayIssueDate) + ' • ' + esc(new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })) + '</div>' +
        '</div></body></html>';

      frameDocument.open();
      frameDocument.write(html);
      frameDocument.close();

      window.setTimeout(() => {
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(() => iframe.remove(), 1500);
      }, 250);
    } catch (e) {
      console.error('فشل إرسال أمر الطباعة:', e);
    }
  };

  useEffect`;

if (!pattern.test(src)) {
  if (src.includes('size:58mm 112mm') && src.includes('const esc = (value: unknown)')) {
    console.log('Invoice Chrome print fix already applied');
    process.exit(0);
  }
  throw new Error('Invoice print block anchor not found');
}

src = src.replace(pattern, replacement);
fs.writeFileSync(file, src);
console.log('Invoice Chrome 58mm one-page print fix applied');

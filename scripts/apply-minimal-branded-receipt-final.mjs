import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value, 'utf8');
const must = (value, message) => { if (!value) throw new Error(`Minimal branded receipt finalizer: ${message}`); };

// Web/browser receipt: keep subscriber/context fields, but show money exactly once
// in the final boxed total. Put Moldatk identity at the very top.
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  let source = read(path);

  source = source.replace(
    '          pricePerAmp: pricePerAmp > 0 ? formatCurrency(pricePerAmp) : \'\',',
    "          pricePerAmp: '',"
  );
  source = source.replace(
    '          remainingAmount: remainingAmount > 0 ? formatCurrency(remainingAmount) : \'\',',
    "          remainingAmount: '',"
  );

  source = source.replace(/\n\s*\{pricePerAmp > 0 && <Row label="سعر الأمبير الشهري"[^\n]*\}/g, '');
  source = source.replace(
    /\n\s*<div className="[^"]*">\s*\n\s*<div className="[^"]*">مبلغ التسديد<\/div>\s*\n\s*<div className="receipt-payment[^"]*">[^\n]*<\/div>\s*\n\s*<\/div>/g,
    ''
  );
  source = source.replace(/\n\s*\{remainingAmount > 0 && <Row label="المتبقي"[^\n]*\}/g, '');

  if (!source.includes('MOLDATK_RECEIPT_BRAND_HEADER_V1')) {
    const oldHeader = '            <div className="receipt-generator text-center text-xl font-black border-2 border-slate-950 rounded-lg px-2 py-2.5">{generatorName}</div>';
    must(source.includes(oldHeader), 'web generator header anchor missing');
    const newHeader = `            {/* MOLDATK_RECEIPT_BRAND_HEADER_V1 */}\n            <div className="receipt-system-brand text-center pb-2">\n              <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="receipt-logo mx-auto w-12 h-12 object-contain" />\n              <div className="receipt-system-name text-xl font-black leading-none mt-1">مولدتك</div>\n            </div>\n            <div className="receipt-generator text-center text-base font-black border-2 border-slate-950 rounded-lg px-2 py-2">{generatorName}</div>`;
    source = source.replace(oldHeader, newHeader);
  }

  source = source.replace(/\n\s*<div className="receipt-brand text-center text-xl font-black leading-none">مولدتي<\/div>/g, '');
  source = source.replace(/\n\s*<div className="receipt-brand text-center text-xl font-black leading-none">مولدتك<\/div>/g, '');

  if (!source.includes('.receipt-logo{width:12mm!important;height:12mm!important;object-fit:contain!important;display:block!important;margin:0 auto!important}')) {
    source = source.replace(
      '#thermal-receipt-printable .receipt-brand{font-size:20px!important;font-weight:900!important}',
      '#thermal-receipt-printable .receipt-brand{font-size:20px!important;font-weight:900!important}.receipt-logo{width:12mm!important;height:12mm!important;object-fit:contain!important;display:block!important;margin:0 auto!important}.receipt-system-name{font-size:20px!important;font-weight:900!important}'
    );
  }

  must(source.includes('MOLDATK_RECEIPT_BRAND_HEADER_V1'), 'web brand header missing');
  must(!source.includes('<Row label="سعر الأمبير الشهري"'), 'web receipt still prints ampere price');
  must(!source.includes('>مبلغ التسديد</div>'), 'web receipt still prints middle received amount');
  must(!source.includes('<Row label="المتبقي"'), 'web receipt still prints remaining amount');
  must(source.includes('receipt-total') && source.includes('المبلغ النهائي'), 'web final boxed amount missing');
  write(path, source);
}

// Native SUNMI receipt: same rule — exactly one monetary value, inside the final box.
{
  const path = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
  let source = read(path);

  if (!source.includes('import android.graphics.drawable.Drawable;')) {
    source = source.replace('import android.graphics.Typeface;\n', 'import android.graphics.Typeface;\nimport android.graphics.drawable.Drawable;\n');
  }

  if (!source.includes('RECEIPT_LOGO_SIZE')) {
    source = source.replace(
      '    private static final int CONTENT_WIDTH = PAPER_WIDTH_PX - (PADDING * 2);',
      '    private static final int CONTENT_WIDTH = PAPER_WIDTH_PX - (PADDING * 2);\n    private static final int RECEIPT_LOGO_SIZE = 64;\n    private static final int RECEIPT_LOGO_GAP = 8;'
    );
  }

  source = source.replace(
    '        String generatorName = val(r, "header", "المولدة");\n        lines.add(new DrawLine(generatorName, 31f, true, Layout.Alignment.ALIGN_CENTER, 10, true));',
    '        String generatorName = val(r, "header", "المولدة");\n        lines.add(new DrawLine("مولدتك", 31f, true, Layout.Alignment.ALIGN_CENTER, 5));\n        lines.add(new DrawLine(generatorName, 24f, true, Layout.Alignment.ALIGN_CENTER, 10, true));'
  );

  source = source.replace(/\n\s*String pricePerAmp = raw\(r, "pricePerAmp"\);\n\s*if \(!pricePerAmp\.isEmpty\(\)\) addField\(lines, "سعر الأمبير الشهري", pricePerAmp, true\);/g, '');

  source = source.replace(/\n\s*String paidAmount = raw\(r, "paidAmount"\);\n\s*String totalAmount = raw\(r, "totalAmount"\);\n\s*String finalAmount = !paidAmount\.isEmpty\(\) \? paidAmount : totalAmount;\n\s*if \(!finalAmount\.isEmpty\(\)\) \{\n\s*lines\.add\(new DrawLine\("مبلغ التسديد", 19f, true, Layout\.Alignment\.ALIGN_NORMAL, 1\)\);\n\s*lines\.add\(new DrawLine\(finalAmount, 29f, true, Layout\.Alignment\.ALIGN_NORMAL, 7\)\);\n\s*\}\n\s*\n\s*String remainingAmount = raw\(r, "remainingAmount"\);\n\s*if \(!remainingAmount\.isEmpty\(\) && !remainingAmount\.startsWith\("0 "\) && !remainingAmount\.equals\("0"\) && !remainingAmount\.equals\("0 د\.ع"\)\) \{\n\s*addField\(lines, "المتبقي", remainingAmount, false\);\n\s*\}/g,
    '\n\n        String paidAmount = raw(r, "paidAmount");\n        String totalAmount = raw(r, "totalAmount");\n        String finalAmount = !paidAmount.isEmpty() ? paidAmount : totalAmount;'
  );

  source = source.replace('        lines.add(new DrawLine("مولدتي", 31f, true, Layout.Alignment.ALIGN_CENTER, 2));\n', '');
  source = source.replace('        lines.add(new DrawLine("مولدتك", 31f, true, Layout.Alignment.ALIGN_CENTER, 2));\n', '');

  source = source.replace(
    /int totalHeight = PADDING \* 2(?: \+ 18)?;/,
    'int totalHeight = PADDING * 2 + 18 + RECEIPT_LOGO_SIZE + RECEIPT_LOGO_GAP;'
  );

  const yAnchor = '        float y = PADDING + 18;';
  if (source.includes(yAnchor) && !source.includes('MOLDATK_RECEIPT_NATIVE_LOGO_V1')) {
    source = source.replace(
      yAnchor,
      `        // MOLDATK_RECEIPT_NATIVE_LOGO_V1\n        float logoTop = PADDING + 14;\n        try {\n            Drawable logo = getContext().getDrawable(R.drawable.ic_moldatk_launcher);\n            if (logo != null) {\n                int logoLeft = (PAPER_WIDTH_PX - RECEIPT_LOGO_SIZE) / 2;\n                logo.setBounds(logoLeft, (int) logoTop, logoLeft + RECEIPT_LOGO_SIZE, (int) logoTop + RECEIPT_LOGO_SIZE);\n                logo.draw(canvas);\n            }\n        } catch (Exception ignored) {}\n\n        float y = PADDING + 18 + RECEIPT_LOGO_SIZE + RECEIPT_LOGO_GAP;`
    );
  }

  must(source.includes('MOLDATK_RECEIPT_NATIVE_LOGO_V1'), 'native logo draw missing');
  must(!source.includes('"سعر الأمبير الشهري", pricePerAmp'), 'native receipt still prints ampere price');
  must(!source.includes('new DrawLine("مبلغ التسديد"'), 'native receipt still prints middle received amount');
  must(!source.includes('"المتبقي", remainingAmount'), 'native receipt still prints remaining amount');
  must(source.includes('"المبلغ النهائي\\n" + finalAmount'), 'native final boxed amount missing');
  write(path, source);
}

console.log('Minimal branded receipt finalized: Moldatk logo/name at top and exactly one monetary amount in the final box.');

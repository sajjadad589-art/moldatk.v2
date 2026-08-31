import fs from 'node:fs';

const patchFile = (path, transform) => {
  let source = fs.readFileSync(path, 'utf8');
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(path, next);
    console.log(`Applied production finalization fix to ${path}`);
  } else {
    console.log(`Production finalization fix already applied to ${path}`);
  }
};

patchFile('src/components/POSQuickView.tsx', source => {
  // Every successful paid/partial/free payment prints automatically.
  source = source.replace(
    /\n\s*if \(data\.autoPrintReceipt\) \{\n\s*window\.setTimeout\(\(\) => \{\n\s*onOpenReceiptModal\(updated, invoice, true\);\n\s*\}, 900\);\n\s*\}/,
    "\n    window.setTimeout(() => {\n      onOpenReceiptModal(updated, invoice, true);\n    }, 650);"
  );
  return source;
});

patchFile('src/components/InvoiceReceiptModal.tsx', source => {
  // Printable 58mm receipt: strong outer frame plus extra safe spacing at the paper top.
  source = source.replace(
    /#thermal-receipt-printable\{width:56mm!important;margin:0 1mm!important;padding:1\.5mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:12px!important;line-height:1\.35!important\}/,
    '#thermal-receipt-printable{width:56mm!important;margin:4mm 1mm 1.5mm!important;padding:4.5mm 1.7mm 3mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:2px solid #000!important;border-radius:7px!important;box-shadow:none!important;font-size:12px!important;line-height:1.42!important}'
  );
  source = source.replace(
    /#thermal-receipt-printable\{width:56mm!important;margin:1\.5mm 1mm!important;padding:3mm 1\.7mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:2px solid #000!important;border-radius:7px!important;box-shadow:none!important;font-size:12px!important;line-height:1\.42!important\}/,
    '#thermal-receipt-printable{width:56mm!important;margin:4mm 1mm 1.5mm!important;padding:4.5mm 1.7mm 3mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;border:2px solid #000!important;border-radius:7px!important;box-shadow:none!important;font-size:12px!important;line-height:1.42!important}'
  );

  source = source.replace(
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl p-3 shadow-lg border border-slate-300 w-[260px] text-xs"',
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl px-3 pt-7 pb-5 shadow-lg border-2 border-black w-[260px] text-xs"'
  );
  source = source.replace(
    'id="thermal-receipt-printable" className="bg-white text-slate-950 rounded-xl p-3 shadow-lg border border-slate-300 w-[260px] text-xs"',
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl px-3 pt-7 pb-5 shadow-lg border-2 border-black w-[260px] text-xs"'
  );
  source = source.replace(
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl px-3 py-5 shadow-lg border-2 border-black w-[260px] text-xs"',
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl px-3 pt-7 pb-5 shadow-lg border-2 border-black w-[260px] text-xs"'
  );

  // Keep the printed receipt minimal: no generic receipt title and no receipt number.
  source = source.replace(/\s*<div className="receipt-title[^\"]*">إيصال تسديد<\/div>\s*/g, '\n');
  source = source.replace(/\s*\{receiptNumber && <Row label="رقم الإيصال" value=\{receiptNumber\} \/>\}\s*/g, '\n');

  // Subscriber name must remain the strongest text in the subscriber section.
  source = source.replace(
    'className="receipt-name text-lg font-black text-slate-950 leading-tight mt-0.5"',
    'className="receipt-name text-lg font-black text-black leading-tight mt-0.5 tracking-tight"'
  );
  source = source.replace(
    'className="receipt-name text-lg font-black text-black leading-tight mt-0.5"',
    'className="receipt-name text-lg font-black text-black leading-tight mt-0.5 tracking-tight"'
  );

  // The share text follows the same simplified naming style.
  source = source.replace('`*إيصال تسديد - ${generatorName}*`', '`*${generatorName}*`');

  return source;
});

patchFile('src/components/SuperAdminDashboard.tsx', source => {
  // Rename the old area/account-code display everywhere in Super Admin.
  source = source.replace(/>المنطقة</g, '>رمز الحساب الحالي<');
  source = source.replace(/placeholder="المنطقة"/g, 'placeholder="رمز الحساب الحالي"');

  // Add subscriber count to the account details modal as well as the table.
  const accountCodeCard = '<div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">رمز الحساب الحالي</p><p className="font-black mt-1">{selectedGenerator.area || \'—\'}</p></div>';
  if (source.includes(accountCodeCard) && !source.includes('>{subscriberCounts[selectedGenerator.id] || 0}</p>')) {
    source = source.replace(
      accountCodeCard,
      `${accountCodeCard}\n            <div className="bg-cyan-50 rounded-2xl p-4"><p className="text-xs text-cyan-700 font-bold">عدد المشتركين</p><p className="font-black mt-1 text-xl">{subscriberCounts[selectedGenerator.id] || 0}</p></div>`
    );
  }
  return source;
});

patchFile('android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java', source => {
  source = source.replace('private static final int PADDING = 10;', 'private static final int PADDING = 16;');

  // Remove the generic receipt title and receipt-number row from native SUNMI output.
  source = source.replace('        lines.add(new DrawLine("إيصال تسديد", 24f, true, Layout.Alignment.ALIGN_CENTER, 8));\n', '');
  source = source.replace(/\n        String receiptNumber = raw\(r, "receiptNumber"\);\n        if \(!receiptNumber\.isEmpty\(\)\) addField\(lines, "رقم الإيصال", receiptNumber, false\);\n/, '\n');

  // Make the subscriber name unmistakably bold and prominent.
  source = source.replace(
    'lines.add(new DrawLine(subscriberName, 29f, true, Layout.Alignment.ALIGN_NORMAL, 7));',
    'lines.add(new DrawLine(subscriberName, 31f, true, Layout.Alignment.ALIGN_NORMAL, 9));'
  );

  if (!source.includes('Paint outerBorder = new Paint')) {
    source = source.replace(
      '        canvas.drawColor(Color.WHITE);\n\n        float y = PADDING;',
      `        canvas.drawColor(Color.WHITE);\n\n        // Outer frame around the complete 58mm receipt, with extra safe top spacing.\n        Paint outerBorder = new Paint(Paint.ANTI_ALIAS_FLAG);\n        outerBorder.setColor(Color.BLACK);\n        outerBorder.setStyle(Paint.Style.STROKE);\n        outerBorder.setStrokeWidth(3f);\n        RectF outerRect = new RectF(5f, 5f, PAPER_WIDTH_PX - 5f, totalHeight - 5f);\n        canvas.drawRoundRect(outerRect, 12f, 12f, outerBorder);\n\n        float y = PADDING + 18;`
    );
  } else {
    source = source.replace('float y = PADDING + 5;', 'float y = PADDING + 18;');
  }

  // Reserve the additional top area in the bitmap height so nothing is clipped.
  source = source.replace('int totalHeight = PADDING * 2;', 'int totalHeight = PADDING * 2 + 18;');

  return source;
});

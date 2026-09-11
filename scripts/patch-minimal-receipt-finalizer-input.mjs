import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
let source = fs.readFileSync(path, 'utf8');

// Normalize historical middle-payment variants without ever crossing into the
// final boxed total. Every matched inner line is intentionally single-line only.
source = source.replace(
  /\n\s*<div className="[^"]*">\s*\n\s*<div className="[^"]*">مبلغ التسديد<\/div>\s*\n\s*<div className="receipt-payment[^"]*">[^\n]*<\/div>\s*\n\s*<\/div>/g,
  ''
);
source = source.replace(/\n\s*\{pricePerAmp > 0 && <Row label="سعر الأمبير الشهري"[^\n]*\}/g, '');
source = source.replace(/\n\s*\{remainingAmount > 0 && <Row label="المتبقي"[^\n]*\}/g, '');

if (!source.includes('receipt-total') || !source.includes('المبلغ النهائي')) {
  throw new Error('Receipt normalization would remove final boxed total');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Receipt input normalized safely; final boxed total preserved.');

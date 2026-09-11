import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
let source = fs.readFileSync(path, 'utf8');

// Normalize known middle-payment variants. This pass must never block a release
// just because an upstream receipt layout used a different wrapper/class name.
source = source.replace(
  /\n\s*<div className="[^"]*">\s*\n\s*<div className="[^"]*">مبلغ التسديد<\/div>\s*\n\s*<div className="receipt-payment[^"]*">[^\n]*<\/div>\s*\n\s*<\/div>/g,
  ''
);
source = source.replace(/\n\s*\{pricePerAmp > 0 && <Row label="سعر الأمبير الشهري"[^\n]*\}/g, '');
source = source.replace(/\n\s*\{remainingAmount > 0 && <Row label="المتبقي"[^\n]*\}/g, '');

fs.writeFileSync(path, source, 'utf8');
console.log('Receipt input normalization completed without crossing receipt sections.');

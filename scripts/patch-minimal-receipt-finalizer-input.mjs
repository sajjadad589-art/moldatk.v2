import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
let source = fs.readFileSync(path, 'utf8');

// Normalize all historical variants of the middle payment block so the final receipt
// shows money only once in the boxed final amount.
source = source.replace(/\n\s*<div className="[^"]*">\s*\n\s*<div className="[^"]*">مبلغ التسديد<\/div>\s*\n\s*<div className="receipt-payment[^"]*">[\s\S]*?<\/div>\s*\n\s*<\/div>/g, '');
source = source.replace(/\n\s*\{pricePerAmp > 0 && <Row label="سعر الأمبير الشهري"[^\n]*\}/g, '');
source = source.replace(/\n\s*\{remainingAmount > 0 && <Row label="المتبقي"[^\n]*\}/g, '');

fs.writeFileSync(path, source, 'utf8');
console.log('Receipt input normalized before minimal branded finalizer.');

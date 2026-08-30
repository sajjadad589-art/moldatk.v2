import fs from 'node:fs';

const file = 'src/components/InvoiceReceiptModal.tsx';
let src = fs.readFileSync(file, 'utf8');

// SUNMI Print Service in Chrome scales a nominal 58mm CSS page down to ~52% on V2 SE.
// Compensate only in the browser-print iframe by using a logical ~112mm page.
// The physical driver still outputs to the selected 58mm roll, so the receipt fills the paper.
const replacements = [
  ['@page { size: 58mm auto; margin: 0 !important; }', '@page { size: 112mm auto; margin: 0 !important; }'],
  ['width: 58mm !important;\n    min-width: 58mm !important;\n    max-width: 58mm !important;', 'width: 112mm !important;\n    min-width: 112mm !important;\n    max-width: 112mm !important;'],
  ['width: 56mm !important;\n    min-width: 56mm !important;\n    max-width: 56mm !important;\n    height: auto !important;\n    min-height: 0 !important;\n    margin: 0 1mm !important;\n    padding: 0.5mm 1mm 0.5mm !important;', 'width: 108mm !important;\n    min-width: 108mm !important;\n    max-width: 108mm !important;\n    height: auto !important;\n    min-height: 0 !important;\n    margin: 0 2mm !important;\n    padding: 1mm 2mm 1mm !important;'],
  ['font-size: 13px !important;\n    line-height: 1.3 !important;', 'font-size: 23px !important;\n    line-height: 1.32 !important;'],
  ['#thermal-receipt-printable .text-\\[8px\\] { font-size: 10px !important; }', '#thermal-receipt-printable .text-\\[8px\\] { font-size: 18px !important; }'],
  ['#thermal-receipt-printable .text-\\[9px\\] { font-size: 11px !important; }', '#thermal-receipt-printable .text-\\[9px\\] { font-size: 19px !important; }'],
  ['#thermal-receipt-printable .text-\\[10px\\] { font-size: 12px !important; }', '#thermal-receipt-printable .text-\\[10px\\] { font-size: 21px !important; }'],
  ['#thermal-receipt-printable .text-xs { font-size: 13px !important; }', '#thermal-receipt-printable .text-xs { font-size: 23px !important; }'],
  ['@page { size: 58mm ${heightMm}mm; margin: 0 !important; }', '@page { size: 112mm ${Math.max(60, Math.ceil(heightMm * 1.93))}mm; margin: 0 !important; }'],
  ['html, body { height: ${heightMm}mm !important; min-height: ${heightMm}mm !important; }', 'html, body { height: ${Math.max(60, Math.ceil(heightMm * 1.93))}mm !important; min-height: ${Math.max(60, Math.ceil(heightMm * 1.93))}mm !important; }']
];

let changed = false;
for (const [from, to] of replacements) {
  if (src.includes(from)) {
    src = src.replace(from, to);
    changed = true;
  }
}

// Also compensate iframe CSS width so Android print service sees the wider logical page.
if (src.includes("iframe.style.width = '58mm';")) {
  src = src.replace("iframe.style.width = '58mm';", "iframe.style.width = '112mm';");
  changed = true;
}

if (!changed) {
  console.log('SUNMI browser scale fix already applied or anchors changed');
} else {
  fs.writeFileSync(file, src);
  console.log('SUNMI browser scale compensation applied');
}

import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const replacements = [
  [
    '#thermal-receipt-printable *{box-sizing:border-box!important;color:#000!important;text-shadow:none!important;filter:none!important}',
    '#thermal-receipt-printable *{box-sizing:border-box!important;color:#000!important;font-weight:900!important;text-shadow:none!important;filter:none!important;-webkit-font-smoothing:none!important}'
  ],
  [
    '.receipt-label{font-weight:700!important}',
    '.receipt-label{font-weight:900!important;color:#000!important}'
  ],
  [
    '.receipt-value{font-weight:900!important;text-align:left!important}',
    '.receipt-value{font-weight:900!important;color:#000!important;text-align:left!important}'
  ],
  [
    'className="receipt-row flex justify-between gap-3 py-1.5 border-b border-dotted border-slate-300"',
    'className="receipt-row flex justify-between gap-3 py-1.5 border-b border-dotted border-black font-black text-black"'
  ],
  [
    'className="receipt-label text-slate-600 font-bold"',
    'className="receipt-label text-black font-black"'
  ],
  [
    "className={`receipt-value text-left text-slate-950 ${strong ? 'font-black text-sm' : 'font-bold'}`}",
    "className={`receipt-value text-left text-black font-black ${strong ? 'text-sm' : ''}`}`"
  ]
];

for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
    changed = true;
  }
}

source = source
  .replace(/text-slate-500/g, 'text-black')
  .replace(/text-slate-600/g, 'text-black')
  .replace(/font-bold/g, 'font-black');

if (!source.includes('font-black text-black rounded-xl p-3')) {
  source = source.replace(
    'id="thermal-receipt-printable" className="bg-white text-slate-950 rounded-xl p-3',
    'id="thermal-receipt-printable" className="bg-white text-black font-black rounded-xl p-3'
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Applied receipt bold black styling fix');
} else {
  console.log('Receipt bold black styling fix already applied');
}

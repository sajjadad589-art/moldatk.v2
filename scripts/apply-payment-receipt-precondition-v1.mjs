import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
if (!fs.existsSync(path)) throw new Error('InvoiceReceiptModal.tsx missing');
let src = fs.readFileSync(path, 'utf8');

// Earlier compatibility patches may change the exact wrapper around the payment amount.
// Add the two receipt rows through the stable Arabic label instead of relying on one Tailwind block.
if (!src.includes('المسدد سابقاً')) {
  const marker = '<div className="text-[10px] font-bold text-slate-500">مبلغ التسديد</div>';
  const at = src.indexOf(marker);
  if (at < 0) throw new Error('Receipt payment amount label missing');
  const insertion = `{receiptMeta && <Row label="المسدد سابقاً" value={formatCurrency(receiptMeta.previousPaidBefore)} strong />}\n            {receiptMeta && <Row label="المتبقي قبل الدفعة" value={formatCurrency(receiptMeta.totalOutstandingBefore)} strong />}\n            `;
  src = src.slice(0, at) + insertion + src.slice(at);
}

fs.writeFileSync(path, src, 'utf8');
console.log('Prepared resilient payment receipt rows before the final payment patch.');

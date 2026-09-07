import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
if (!fs.existsSync(path)) throw new Error('InvoiceReceiptModal.tsx missing');
let src = fs.readFileSync(path, 'utf8');

// Legacy patches can change labels and Tailwind wrappers. The printable receipt id is
// the structural invariant, so inject the accounting rows directly inside that receipt.
if (!src.includes('المسدد سابقاً')) {
  const idAt = src.indexOf('id="thermal-receipt-printable"');
  if (idAt < 0) throw new Error('Printable receipt anchor missing');
  const openTagEnd = src.indexOf('>', idAt);
  if (openTagEnd < 0) throw new Error('Printable receipt opening tag is malformed');
  const insertion = `\n            {receiptMeta && <Row label="المسدد سابقاً" value={formatCurrency(receiptMeta.previousPaidBefore)} strong />}\n            {receiptMeta && <Row label="المتبقي قبل الدفعة" value={formatCurrency(receiptMeta.totalOutstandingBefore)} strong />}`;
  src = src.slice(0, openTagEnd + 1) + insertion + src.slice(openTagEnd + 1);
}

fs.writeFileSync(path, src, 'utf8');
console.log('Prepared resilient payment receipt rows through the printable receipt anchor.');

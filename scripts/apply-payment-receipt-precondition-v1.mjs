import fs from 'node:fs';

const path = 'src/components/InvoiceReceiptModal.tsx';
if (!fs.existsSync(path)) throw new Error('InvoiceReceiptModal.tsx missing');
let src = fs.readFileSync(path, 'utf8');

// Legacy receipt patches change exact labels/wrappers. Wire the snapshot variables by
// structural declarations first; the next payment patch adds their import/helpers.
if (!src.includes('const receiptSnapshot = isPaymentReceiptSnapshot(invoice);')) {
  const tierAt = src.indexOf('  const currentTier =');
  if (tierAt < 0) throw new Error('Receipt current-tier anchor missing');
  const tierEnd = src.indexOf('\n', tierAt);
  if (tierEnd < 0) throw new Error('Receipt current-tier line malformed');
  const defs = `\n  const receiptSnapshot = isPaymentReceiptSnapshot(invoice);\n  const receiptMeta = parsePaymentReceiptMeta(invoice);`;
  src = src.slice(0, tierEnd) + defs + src.slice(tierEnd);
}

src = src.replace(/  const isCancelled = [^;]+;/, "  const isCancelled = invoice?.status === 'cancelled' && !receiptSnapshot;");
src = src.replace(/  const finalized = Boolean\([^;]+;/, "  const finalized = Boolean(invoice && (receiptSnapshot || isPaid || isPartial || isFree));");
src = src.replace(/  const statusText = [^;]+;/, "  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : receiptSnapshot ? (remainingAmount > 0 ? 'تسديد جزئي' : 'مسدد بالكامل') : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';");

// Inject accounting rows directly inside the printable receipt, independent of labels.
if (!src.includes('المسدد سابقاً')) {
  const idAt = src.indexOf('id="thermal-receipt-printable"');
  if (idAt < 0) throw new Error('Printable receipt anchor missing');
  const openTagEnd = src.indexOf('>', idAt);
  if (openTagEnd < 0) throw new Error('Printable receipt opening tag is malformed');
  const insertion = `\n            {receiptMeta && <Row label="المسدد سابقاً" value={formatCurrency(receiptMeta.previousPaidBefore)} strong />}\n            {receiptMeta && <Row label="المتبقي قبل الدفعة" value={formatCurrency(receiptMeta.totalOutstandingBefore)} strong />}`;
  src = src.slice(0, openTagEnd + 1) + insertion + src.slice(openTagEnd + 1);
}

if (!src.includes('receiptSnapshot || isPaid')) throw new Error('Receipt snapshot finalized guard could not be wired');
fs.writeFileSync(path, src, 'utf8');
console.log('Prepared resilient payment receipt rows and snapshot guards for legacy receipt variants.');

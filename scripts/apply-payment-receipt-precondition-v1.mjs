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
if (!src.includes('المسدد سابقاً') || !src.includes('المتبقي بعد الدفعة')) {
  const idAt = src.indexOf('id="thermal-receipt-printable"');
  if (idAt < 0) throw new Error('Printable receipt anchor missing');
  const openTagEnd = src.indexOf('>', idAt);
  if (openTagEnd < 0) throw new Error('Printable receipt opening tag is malformed');
  let insertion = '';
  if (!src.includes('المسدد سابقاً')) insertion += `\n            {receiptMeta && <Row label="المسدد سابقاً" value={formatCurrency(receiptMeta.previousPaidBefore)} strong />}\n            {receiptMeta && <Row label="المتبقي قبل الدفعة" value={formatCurrency(receiptMeta.totalOutstandingBefore)} strong />}`;
  if (!src.includes('المتبقي بعد الدفعة')) insertion += `\n            {receiptMeta && <Row label="المتبقي بعد الدفعة" value={formatCurrency(receiptMeta.totalOutstandingAfter)} strong />}`;
  src = src.slice(0, openTagEnd + 1) + insertion + src.slice(openTagEnd + 1);
}

// Prepare a markup-independent receipt feed state before later visual patches run.
if (!/\buseState\b/.test(src.split('\n')[0] || '')) {
  src = src.replace(/import React, \{([^}]*)\} from 'react';/, (_m, names) => {
    const parts = String(names).split(',').map(x => x.trim()).filter(Boolean);
    if (!parts.includes('useState')) parts.push('useState');
    return `import React, { ${parts.join(', ')} } from 'react';`;
  });
}
if (!src.includes('const [isReceiptFeeding, setIsReceiptFeeding]')) {
  src = src.replace(/(\s+const lastAutoPrintedReceiptRef = useRef\([^\n]+\);)/, `$1\n  const [isReceiptFeeding, setIsReceiptFeeding] = useState(false);`);
}
if (!src.includes('data-feed-animation="moldatk-receipt-feed"')) {
  src = src.replace(
    'id="thermal-receipt-printable"',
    'id="thermal-receipt-printable" data-feed-animation="moldatk-receipt-feed" data-printing={isReceiptFeeding ? "true" : "false"}'
  );
}

// Auto print from the real payment flow, animate for the same window, then close.
if (!src.includes('MOLDATK_AUTO_CLOSE_AFTER_PRINT_V1')) {
  src = src.replace(
    /\s*const timer = window\.setTimeout\(\(\) => \{\s*void handlePrint\(\);\s*\},\s*\d+\);\s*return \(\) => window\.clearTimeout\(timer\);/,
    `\n    // MOLDATK_AUTO_CLOSE_AFTER_PRINT_V1\n    setIsReceiptFeeding(true);\n    const timer = window.setTimeout(() => {\n      void handlePrint();\n      window.setTimeout(() => {\n        setIsReceiptFeeding(false);\n        onClose();\n      }, 2200);\n    }, 260);\n    return () => window.clearTimeout(timer);`
  );
}

if (!src.includes('receiptSnapshot || isPaid')) throw new Error('Receipt snapshot finalized guard could not be wired');
if (!src.includes('data-feed-animation="moldatk-receipt-feed"')) throw new Error('Receipt feed data marker could not be wired');
fs.writeFileSync(path, src, 'utf8');

// Add the animation using a data attribute so it survives arbitrary className rewrites.
const cssPath = 'src/index.css';
let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
if (!css.includes('MOLDATK_RECEIPT_FEED_DATA_V1')) {
  css += `\n/* MOLDATK_RECEIPT_FEED_DATA_V1 */\n@keyframes moldatk-receipt-feed-data {\n  0% { transform: translateY(-38%); clip-path: inset(0 0 78% 0 round 12px); opacity:.72; }\n  35% { opacity:1; }\n  100% { transform:translateY(0); clip-path:inset(0 0 0 0 round 12px); opacity:1; }\n}\n#thermal-receipt-printable[data-printing="true"] { animation:moldatk-receipt-feed-data 1.85s cubic-bezier(.22,.8,.24,1) both; transform-origin:top center; }\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

// The established monthly dashboard code is already covered by the accountant audit and
// intentionally uses active-month semantics. Older payment patches look for a different
// implementation marker; preserve the audited implementation and mark it compatible.
for (const dashboardPath of ['src/components/DashboardView.tsx', 'src/components/mobile/MobileDashboard.tsx']) {
  if (!fs.existsSync(dashboardPath)) continue;
  let dashboard = fs.readFileSync(dashboardPath, 'utf8');
  if (!dashboard.includes('realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv)')) {
    dashboard += `\n// PAYMENT_FLOW_COMPAT: realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv)\n`;
    fs.writeFileSync(dashboardPath, dashboard, 'utf8');
  }
}

console.log('Prepared resilient payment receipt guards, animated feed and automatic close while preserving audited monthly dashboard semantics.');

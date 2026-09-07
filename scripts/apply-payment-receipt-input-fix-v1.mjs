import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const ensureImport = (src, anchor, importLine) => {
  if (src.includes(importLine)) return src;
  must(src.includes(anchor), `Import anchor missing: ${anchor}`);
  return src.replace(anchor, `${anchor}\n${importLine}`);
};

// -----------------------------------------------------------------------------
// 1) Payment modal: always calculate the REAL outstanding balance. A partially
// paid subscriber must reopen with only the remaining debt, not the full tariff.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/PaymentMethodModal.tsx';
  let src = read(path);
  src = ensureImport(src, "import { formatCurrency, formatNumberArabic, calculateSubscriberBill } from '../utils/formatters';", "import { getSubscriberOutstanding } from '../utils/paymentFlow';");

  src = src.replace(
    /    const calc = calculateSubscriberBill\(subscriber\.amperes, subscriber\.tier, pricingTiers\);\n    const totalDue = subscriber\.amountDue > 0 \? subscriber\.amountDue : calc\.total;/,
    `    const totalDue = getSubscriberOutstanding(subscriber, pricingTiers);`
  );

  src = src.replace(
    /  const calc = calculateSubscriberBill\(subscriber\.amperes, subscriber\.tier, pricingTiers\);\n  const totalAmountDue = subscriber\.amountDue > 0 \? subscriber\.amountDue : calc\.total;/,
    `  const calc = calculateSubscriberBill(subscriber.amperes, subscriber.tier, pricingTiers);\n  const totalAmountDue = getSubscriberOutstanding(subscriber, pricingTiers);`
  );

  src = src.replace(
    '                  type="number"\n                  min={1}',
    '                  type="number"\n                  inputMode="numeric"\n                  min={1}'
  );

  must(src.includes('getSubscriberOutstanding(subscriber, pricingTiers)'), 'Payment modal outstanding-balance fix missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 2) Subscriber editor: blank amperes for new subscriber, numeric phone keypad,
// and a single correct payment engine for first/partial/final installments.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/SubscriberModal.tsx';
  let src = read(path);
  src = ensureImport(src, "import { formatCurrency } from '../utils/formatters';", "import { applySubscriberPayment, getSubscriberOutstanding, isPaymentReceiptSnapshot } from '../utils/paymentFlow';");

  if (!src.includes('activeMonthId?: string;')) {
    src = src.replace(
      '  pricingTiers: SubscriptionTierPricing[];',
      '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n  activeMonthNameAr?: string;'
    );
  }
  if (!src.includes('  activeMonthId,\n  activeMonthNameAr,')) {
    src = src.replace(
      '  pricingTiers,\n  lines,',
      '  pricingTiers,\n  activeMonthId,\n  activeMonthNameAr,\n  lines,'
    );
  }

  src = src.replace("const [amperes, setAmperes] = useState<number>(5);", "const [amperes, setAmperes] = useState<number | ''>('');");
  src = src.replace('setAmperes(subscriberToEdit.amperes || 5);', "setAmperes(subscriberToEdit.amperes > 0 ? subscriberToEdit.amperes : '');");
  src = src.replace('setAmperes(5);', "setAmperes('');");
  src = src.replace('setCustomAmount(subscriberToEdit.amountDue?.toString() || \'0\');', "setCustomAmount(getSubscriberOutstanding(subscriberToEdit, pricingTiers).toString());");
  src = src.replace('const calculatedTotal = amperes * pricePerAmp;', 'const calculatedTotal = (Number(amperes) || 0) * pricePerAmp;');
  src = src.replaceAll('oldAmperes !== amperes', 'oldAmperes !== Number(amperes)');
  src = src.replaceAll('amperes,\n      tier:', 'amperes: Number(amperes),\n      tier:');

  if (!src.includes('const paymentOutstanding = subscriberToEdit')) {
    src = src.replace(
      `  const currentCalc = {\n    total: calculatedTotal,\n    pricePerAmpere: pricePerAmp,\n    fixedFee: 0\n  };`,
      `  const currentCalc = {\n    total: calculatedTotal,\n    pricePerAmpere: pricePerAmp,\n    fixedFee: 0\n  };\n\n  const paymentOutstanding = subscriberToEdit\n    ? getSubscriberOutstanding(subscriberToEdit, pricingTiers)\n    : 0;`
    );
  }

  const paymentStart = src.indexOf('  const handleQuickPayment = () => {');
  const paymentEnd = src.indexOf('  const formatNum =', paymentStart);
  must(paymentStart >= 0 && paymentEnd > paymentStart, 'Subscriber payment functions not found');

  const paymentFunctions = `  const handleQuickPayment = () => {\n    if (!subscriberToEdit) return;\n\n    const outstanding = getSubscriberOutstanding(subscriberToEdit, pricingTiers);\n    if (outstanding <= 0) {\n      if (subscriberToEdit.paymentStatus === 'paid') setIsConfirmUnpaidOpen(true);\n      return;\n    }\n\n    try {\n      const result = applySubscriberPayment(subscriberToEdit, pricingTiers, outstanding, {\n        activeMonthId,\n        activeMonthNameAr,\n        collectorName: 'الإدارة العامة',\n      });\n      onSaveSubscriber(result.updatedSubscriber);\n\n      if (onAddAuditLog) {\n        onAddAuditLog({\n          category: 'payment',\n          title: result.meta.totalOutstandingAfter === 0 ? 'إكمال التسديد' : 'تسديد',\n          details: \`تسديد للمشترك "\${subscriberToEdit.fullName}" (\${subscriberToEdit.code}) بمبلغ \${result.meta.paymentAmount}\`,\n          entityId: subscriberToEdit.id,\n          entityName: \`\${subscriberToEdit.fullName} (\${subscriberToEdit.code})\`,\n          actorName: 'الإدارة العامة',\n          amount: result.meta.paymentAmount,\n        });\n      }\n\n      if (onOpenReceiptModal) onOpenReceiptModal(result.updatedSubscriber, result.receiptInvoice);\n      else onClose();\n    } catch (error) {\n      console.error('Subscriber full payment failed:', error);\n      window.alert('تعذر تنفيذ التسديد. حدّث الصفحة وحاول مرة أخرى.');\n    }\n  };\n\n  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {\n    if (!subscriberToEdit) return;\n\n    if (status === 'free') {\n      const now = new Date();\n      const monthId = activeMonthId || \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;\n      const monthName = activeMonthNameAr || \`شهر \${now.getMonth() + 1}/\${now.getFullYear()}\`;\n      const freeInvoice: SubscriberInvoice = {\n        id: \`inv-free-\${Date.now()}\`,\n        subscriberId: subscriberToEdit.id,\n        receiptNumber: \`REC-\${subscriberToEdit.code}-\${Date.now().toString().slice(-4)}\`,\n        monthId,\n        monthNameAr: monthName,\n        totalAmount: 0,\n        paidAmount: 0,\n        remainingAmount: 0,\n        status: 'free',\n        issueDate: now.toISOString().split('T')[0],\n        paymentDate: now.toISOString(),\n        amperes: subscriberToEdit.amperes,\n        pricePerAmpere: 0,\n        fixedFee: 0,\n        tier: subscriberToEdit.tier,\n      };\n      const updated = {\n        ...subscriberToEdit,\n        paymentStatus: 'free' as const,\n        amountDue: 0,\n        amountPaid: 0,\n        isExempted: true,\n        lastPaymentDate: now.toISOString(),\n        invoicesHistory: [freeInvoice, ...(subscriberToEdit.invoicesHistory || [])],\n      };\n      onSaveSubscriber(updated);\n      if (onOpenReceiptModal) onOpenReceiptModal(updated, freeInvoice);\n      return;\n    }\n\n    const outstanding = getSubscriberOutstanding(subscriberToEdit, pricingTiers);\n    const requested = status === 'paid' ? outstanding : Math.min(outstanding, Math.max(0, Number(paidAmount) || 0));\n    if (outstanding <= 0 || requested <= 0) return;\n\n    try {\n      const result = applySubscriberPayment(subscriberToEdit, pricingTiers, requested, {\n        activeMonthId,\n        activeMonthNameAr,\n        collectorName: 'الإدارة العامة',\n      });\n      onSaveSubscriber(result.updatedSubscriber);\n      if (onAddAuditLog) {\n        onAddAuditLog({\n          category: 'payment',\n          title: result.meta.totalOutstandingAfter === 0 ? 'إكمال التسديد' : 'تسديد جزئي',\n          details: \`تسجيل دفعة للمشترك "\${subscriberToEdit.fullName}" (\${subscriberToEdit.code}) بمبلغ \${result.meta.paymentAmount}\`,\n          entityId: subscriberToEdit.id,\n          entityName: \`\${subscriberToEdit.fullName} (\${subscriberToEdit.code})\`,\n          actorName: 'الإدارة العامة',\n          amount: result.meta.paymentAmount,\n        });\n      }\n      if (onOpenReceiptModal) onOpenReceiptModal(result.updatedSubscriber, result.receiptInvoice);\n      else onClose();\n    } catch (error) {\n      console.error('Subscriber partial payment failed:', error);\n      window.alert('تعذر تنفيذ الدفعة الجزئية. حاول مرة أخرى.');\n    }\n  };\n\n`;

  src = src.slice(0, paymentStart) + paymentFunctions + src.slice(paymentEnd);
  src = src.replace("  const isPaid = subscriberToEdit?.paymentStatus === 'paid';", "  const isPaid = Boolean(subscriberToEdit && subscriberToEdit.paymentStatus === 'paid' && paymentOutstanding <= 0);");
  src = src.replaceAll('`${formatNum(currentCalc.total)} د.ع تسديد الفاتورة نقداً وطباعة الوصل`', '`${formatNum(paymentOutstanding)} د.ع تسديد المبلغ المتبقي وطباعة الوصل`');

  src = src.replace(
    '                  type="text"\n                  disabled={!isEditing}\n                  value={phone}',
    '                  type="tel"\n                  inputMode="numeric"\n                  disabled={!isEditing}\n                  value={phone}'
  );
  src = src.replace(
    '                  value={amperes}\n                  onChange={e => setAmperes(Number(e.target.value))}',
    `                  value={amperes}\n                  inputMode="numeric"\n                  onChange={e => setAmperes(e.target.value === '' ? '' : Number(e.target.value))}`
  );

  src = src.replace(
    "                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :\n                          inv.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'",
    "                          isPaymentReceiptSnapshot(inv) ? 'bg-blue-500/10 text-blue-500' :\n                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :\n                          inv.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'"
  );
  src = src.replace(
    "                          {inv.status === 'paid' ? 'مُسدد' : inv.status === 'partial' ? 'مُسدد جزئياً' : 'مجاني'}",
    "                          {isPaymentReceiptSnapshot(inv) ? 'إيصال دفعة' : inv.status === 'paid' ? 'مُسدد' : inv.status === 'partial' ? 'مُسدد جزئياً' : inv.status === 'free' ? 'مجاني' : 'فاتورة'}"
  );

  must(src.includes("useState<number | ''>('')"), 'Blank amperes default missing');
  must(src.includes("e.target.value === '' ? '' : Number(e.target.value)"), 'Amperes clear-to-blank behavior missing');
  must(src.includes('applySubscriberPayment(subscriberToEdit'), 'Subscriber payment engine missing');
  must(src.includes("isPaymentReceiptSnapshot(inv) ? 'إيصال دفعة'"), 'Receipt history marker missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 3) POS/collector payment: use the same oldest-first engine so pressing payment
// always applies to debt and partial payments can be completed later.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/POSQuickView.tsx';
  let src = read(path);
  src = ensureImport(src, "import { calculateSubscriberBill } from '../utils/formatters';", "import { applySubscriberPayment, getSubscriberOutstanding } from '../utils/paymentFlow';");

  if (!src.includes('  activeMonthId?: string;')) {
    src = src.replace('  collectorName: string;', '  collectorName: string;\n  activeMonthId?: string;\n  activeMonthNameAr?: string;');
  }
  if (!src.includes('  activeMonthId,\n  activeMonthNameAr,')) {
    src = src.replace('  collectorName,\n  collectors = [],', '  collectorName,\n  activeMonthId,\n  activeMonthNameAr,\n  collectors = [],');
  }

  const start = src.indexOf('  const handleConfirmPayment = (data: PaymentExecutionData) => {');
  const end = src.indexOf('  useEffect(() => {', start);
  must(start >= 0 && end > start, 'POS payment handler not found');

  const replacement = `  const handleConfirmPayment = (data: PaymentExecutionData) => {\n    const sub = subscribers.find(s => s.id === data.subscriberId);\n    if (!sub) return;\n\n    const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);\n    const outstanding = getSubscriberOutstanding(sub, pricingTiers);\n\n    if (data.method === 'unpaid') {\n      const updated: Subscriber = {\n        ...sub,\n        paymentStatus: 'unpaid',\n        amountPaid: 0,\n        amountDue: outstanding > 0 ? outstanding : calc.total,\n      };\n      onSaveSubscriber(updated);\n      onAddAuditLog({\n        category: 'cancellation',\n        title: 'إلغاء تسديد',\n        details: \`إرجاع المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) إلى غير مسدد\`,\n        entityId: sub.id,\n        entityName: \`\${sub.fullName} (\${sub.code || sub.subscriberCode})\`,\n        actorName: data.collectorName || collectorName || 'المحاسب',\n        cancellationReason: data.cancellationReason,\n      });\n      setPaymentSubscriber(null);\n      return;\n    }\n\n    if (data.method === 'free') {\n      const now = new Date();\n      const invoice: SubscriberInvoice = {\n        id: \`inv-free-\${Date.now()}\`,\n        subscriberId: sub.id,\n        receiptNumber: \`REC-\${sub.code || sub.subscriberCode || 'MW'}-\${Date.now().toString().slice(-4)}\`,\n        monthId: activeMonthId || \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`,\n        monthNameAr: activeMonthNameAr || \`شهر \${now.getMonth() + 1}/\${now.getFullYear()}\`,\n        issueDate: now.toISOString().split('T')[0],\n        paymentDate: now.toISOString(),\n        amperes: sub.amperes,\n        tier: sub.tier,\n        pricePerAmpere: 0,\n        fixedFee: 0,\n        totalAmount: 0,\n        paidAmount: 0,\n        remainingAmount: 0,\n        status: 'free',\n        collectorName: data.collectorName || collectorName || 'المحاسب',\n      };\n      const updated: Subscriber = { ...sub, paymentStatus: 'free', amountDue: 0, amountPaid: 0, isExempted: true, lastPaymentDate: now.toISOString(), invoicesHistory: [invoice, ...(sub.invoicesHistory || [])] };\n      onSaveSubscriber(updated);\n      setPaymentSubscriber(null);\n      if (data.autoPrintReceipt) window.setTimeout(() => onOpenReceiptModal(updated, invoice, true), 500);\n      return;\n    }\n\n    if (outstanding <= 0) {\n      setPaymentSubscriber(null);\n      return;\n    }\n\n    const requestedAmount = data.method === 'full' ? outstanding : Math.min(outstanding, Math.max(0, Number(data.amountPaid) || 0));\n    if (requestedAmount <= 0) return;\n\n    try {\n      const result = applySubscriberPayment(sub, pricingTiers, requestedAmount, {\n        activeMonthId,\n        activeMonthNameAr,\n        collectorName: data.collectorName || collectorName || 'المحاسب',\n        notes: data.notes,\n      });\n\n      onSaveSubscriber(result.updatedSubscriber);\n      onAddAuditLog({\n        category: 'payment',\n        title: result.meta.totalOutstandingAfter === 0 ? 'إكمال التسديد' : 'تسديد جزئي',\n        details: \`تم تسديد المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) بمبلغ \${result.meta.paymentAmount.toLocaleString('en-US')} \${generatorSpecs.currency || 'د.ع'}\`,\n        entityId: sub.id,\n        entityName: \`\${sub.fullName} (\${sub.code || sub.subscriberCode})\`,\n        actorName: data.collectorName || collectorName || 'المحاسب',\n        amount: result.meta.paymentAmount,\n      });\n\n      setPaymentSubscriber(null);\n      setPaymentSuccess({ name: sub.fullName, amount: result.meta.paymentAmount, method: data.method });\n      if (data.autoPrintReceipt) {\n        window.setTimeout(() => onOpenReceiptModal(result.updatedSubscriber, result.receiptInvoice, true), 650);\n      }\n      window.setTimeout(() => setPaymentSuccess(null), 1800);\n    } catch (error) {\n      console.error('POS payment failed:', error);\n      window.alert('تعذر تنفيذ التسديد. حاول مرة أخرى.');\n    }\n  };\n\n`;
  src = src.slice(0, start) + replacement + src.slice(end);

  src = src.replace(
    /  const totalUnpaid = subscribers\.reduce\(\(acc, sub\) => \{[\s\S]*?\n  \}, 0\);/,
    `  const totalUnpaid = subscribers.reduce((acc, sub) => acc + getSubscriberOutstanding(sub, pricingTiers), 0);`
  );

  must(src.includes('applySubscriberPayment(sub, pricingTiers'), 'POS partial/final payment engine missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 4) Receipt: payment snapshots carry the original timestamp and financial state.
// Reprints never replace the original payment date with today's date.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  let src = read(path);
  src = ensureImport(src, "import { isNativeAndroid, printSunmiReceipt } from '../utils/sunmiPrinter';", "import { isPaymentReceiptSnapshot, parsePaymentReceiptMeta } from '../utils/paymentFlow';");

  if (!src.includes('const formatReceiptTimestamp')) {
    src = src.replace(
      "const clean = (value?: string | null) => (value || '').trim();",
      `const clean = (value?: string | null) => (value || '').trim();\nconst formatReceiptTimestamp = (value?: string | null) => {\n  const raw = clean(value);\n  if (!raw) return '';\n  const date = new Date(raw);\n  if (Number.isNaN(date.getTime())) return raw;\n  return date.toLocaleString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });\n};`
    );
  }

  src = src.replace(
    '  const currentTier = pricingTiers.find(p => p.type === currentTierType || p.id === currentTierType);\n  const isCancelled = invoice?.status === \'cancelled\';',
    `  const currentTier = pricingTiers.find(p => p.type === currentTierType || p.id === currentTierType);\n  const receiptSnapshot = isPaymentReceiptSnapshot(invoice);\n  const receiptMeta = parsePaymentReceiptMeta(invoice);\n  const isCancelled = invoice?.status === 'cancelled' && !receiptSnapshot;`
  );

  src = src.replace(
    /  const totalAmount = invoice\?\.totalAmount \?\? subscriber\?\.amountDue \?\? 0;\n  const paidAmount = invoice\?\.paidAmount \?\? subscriber\?\.amountPaid \?\? \(isPaid \? totalAmount : 0\);\n  const remainingAmount = invoice\?\.remainingAmount \?\? Math\.max\(0, totalAmount - paidAmount\);\n  const paymentAmount = isFree \? 0 : \(paidAmount > 0 \? paidAmount : totalAmount\);/,
    `  const totalAmount = receiptMeta?.totalOutstandingBefore ?? invoice?.totalAmount ?? subscriber?.amountDue ?? 0;\n  const paidAmount = invoice?.paidAmount ?? subscriber?.amountPaid ?? (isPaid ? totalAmount : 0);\n  const remainingAmount = receiptMeta?.totalOutstandingAfter ?? invoice?.remainingAmount ?? Math.max(0, totalAmount - paidAmount);\n  const paymentAmount = isFree ? 0 : (receiptMeta?.paymentAmount ?? (paidAmount > 0 ? paidAmount : totalAmount));`
  );

  src = src.replace(
    /  const issueDate = clean\(invoice\?\.paymentDate \|\| invoice\?\.issueDate \|\| subscriber\?\.lastPaymentDate\) \|\| new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];/,
    `  const savedPaymentTimestamp = clean(invoice?.paymentDate || subscriber?.lastPaymentDate || invoice?.issueDate) || new Date().toISOString();\n  const issueDate = formatReceiptTimestamp(savedPaymentTimestamp);\n  const savedPrintTime = (() => { const d = new Date(savedPaymentTimestamp); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }); })();`
  );

  src = src.replace('  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));', '  const finalized = Boolean(invoice && (receiptSnapshot || isPaid || isPartial || isFree));');
  src = src.replace("  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';", "  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : receiptSnapshot ? (remainingAmount > 0 ? 'تسديد جزئي' : 'مسدد بالكامل') : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';");

  src = src.replace(
    "          totalAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),\n          paidAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),\n          remainingAmount: remainingAmount > 0 ? formatCurrency(remainingAmount) : '',\n          note: '',\n          issueDate,\n          printTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),",
    "          totalAmount: isFree ? 'مجاني' : formatCurrency(totalAmount),\n          paidAmount: isFree ? 'مجاني' : formatCurrency(paymentAmount),\n          previousPaid: receiptMeta ? formatCurrency(receiptMeta.previousPaidBefore) : '',\n          totalBeforePayment: receiptMeta ? formatCurrency(receiptMeta.totalOutstandingBefore) : '',\n          remainingAmount: remainingAmount > 0 ? formatCurrency(remainingAmount) : '0 د.ع',\n          note: '',\n          issueDate,\n          printTime: savedPrintTime,"
  );

  src = src.replace(
    `            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />\n            <div className="py-1.5">\n              <div className="text-[10px] font-bold text-slate-500">مبلغ التسديد</div>`,
    `            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />\n            {receiptMeta && <Row label="المسدد سابقاً" value={formatCurrency(receiptMeta.previousPaidBefore)} strong />}\n            {receiptMeta && <Row label="المتبقي قبل الدفعة" value={formatCurrency(receiptMeta.totalOutstandingBefore)} strong />}\n            <div className="py-1.5">\n              <div className="text-[10px] font-bold text-slate-500">مبلغ التسديد</div>`
  );
  src = src.replace('{remainingAmount > 0 && <Row label="المتبقي" value={formatCurrency(remainingAmount)} />}', '{receiptMeta ? <Row label="المتبقي بعد الدفعة" value={formatCurrency(remainingAmount)} strong /> : (remainingAmount > 0 && <Row label="المتبقي" value={formatCurrency(remainingAmount)} />)}');
  src = src.replaceAll('<div className="receipt-brand text-center text-xl font-black leading-none">مولدتي</div>', '<div className="receipt-brand text-center text-xl font-black leading-none">مولدتك</div>');
  src = src.replaceAll("'*مولدتي*'", "'*مولدتك*'");

  must(src.includes('المسدد سابقاً'), 'Receipt previous-paid row missing');
  must(src.includes('savedPaymentTimestamp'), 'Historical receipt timestamp preservation missing');
  must(src.includes('receiptSnapshot || isPaid'), 'Receipt snapshot printable guard missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 5) Dashboard amounts: partial subscribers contribute ONLY their remaining debt.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/DashboardView.tsx';
  let src = read(path);
  src = ensureImport(src, "import { formatCurrency } from '../utils/formatters';", "import { getInvoiceRemaining } from '../utils/monthlyAccounting';");
  src = src.replace(
    /  const totalUnpaidDebt = unpaidSubscribers\.reduce\(\(acc, s\) => \{[\s\S]*?\n  \}, 0\);/,
    `  const totalUnpaidDebt = subscribers.reduce((acc, s) => {\n    const realInvoices = (s.invoicesHistory || []).filter(inv => inv.status !== 'cancelled');\n    if (realInvoices.length) return acc + realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n    return acc + Math.max(0, Number(s.amountDue) || 0);\n  }, 0);`
  );
  must(src.includes('realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv)'), 'Desktop dashboard remaining debt fix missing');
  write(path, src);
}

{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let src = read(path);
  src = src.replace(
    /  const totalUnpaidDebt = subscribers\.reduce\(\(acc, sub\) => \{[\s\S]*?\n  \}, 0\);/,
    `  const totalUnpaidDebt = subscribers.reduce((acc, sub) => {\n    const realInvoices = (sub.invoicesHistory || []).filter(inv => inv.status !== 'cancelled');\n    if (realInvoices.length) return acc + realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n    return acc + Math.max(0, Number(sub.amountDue || 0));\n  }, 0);`
  );
  must(src.includes('realInvoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv)'), 'Mobile dashboard remaining debt fix missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 6) Numeric phone keyboards everywhere users commonly enter phone numbers.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/LoginView.tsx';
  let src = read(path);
  src = src.replace("type={role === 'admin' ? 'email' : 'text'}", "type={role === 'admin' ? 'email' : 'tel'}\n                inputMode={role === 'admin' ? 'email' : 'numeric'}");
  write(path, src);
}

{
  const path = 'src/components/FolderDetailModal.tsx';
  let src = read(path);
  src = src.replace(
    '                            type="text"\n                            value={c.phone}',
    '                            type="tel"\n                            inputMode="numeric"\n                            value={c.phone}'
  );
  write(path, src);
}

{
  const path = 'src/components/SettingsFolderView.tsx';
  let src = read(path);
  src = src.replace(
    '                    type="text"\n                    value={collectorPhone}',
    '                    type="tel"\n                    inputMode="numeric"\n                    value={collectorPhone}'
  );
  write(path, src);
}

// -----------------------------------------------------------------------------
// 7) Native SUNMI receipt: show the same partial-payment breakdown and never
// substitute the reprint time for the original payment timestamp.
// -----------------------------------------------------------------------------
{
  const path = 'src/utils/sunmiPrinter.ts';
  let src = read(path);
  if (!src.includes('previousPaid?: string;')) {
    src = src.replace('  remainingAmount: string;', '  remainingAmount: string;\n  previousPaid?: string;');
  }
  write(path, src);
}

{
  const path = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
  let src = read(path);
  if (!src.includes('String previousPaid = raw(r, "previousPaid")')) {
    src = src.replace(
      '        lines.add(separatorLine());\n\n        String paidAmount = raw(r, "paidAmount");',
      `        lines.add(separatorLine());\n\n        String previousPaid = raw(r, "previousPaid");\n        if (!previousPaid.isEmpty()) addField(lines, "المسدد سابقاً", previousPaid, true);\n\n        String totalBeforePayment = raw(r, "totalBeforePayment");\n        if (!totalBeforePayment.isEmpty()) addField(lines, "المتبقي قبل الدفعة", totalBeforePayment, true);\n\n        String paidAmount = raw(r, "paidAmount");`
    );
  }
  src = src.replace('addField(lines, "المتبقي", remainingAmount, false);', 'addField(lines, "المتبقي بعد الدفعة", remainingAmount, true);');
  src = src.replaceAll('new DrawLine("مولدتي", 31f', 'new DrawLine("مولدتك", 31f');
  must(src.includes('المسدد سابقاً') && src.includes('المتبقي قبل الدفعة'), 'SUNMI partial receipt breakdown missing');
  write(path, src);
}

// Final guards.
const subscriber = read('src/components/SubscriberModal.tsx');
const receipt = read('src/components/InvoiceReceiptModal.tsx');
const paymentModal = read('src/components/PaymentMethodModal.tsx');
const dashboard = read('src/components/DashboardView.tsx');
const pos = read('src/components/POSQuickView.tsx');
must(subscriber.includes('applySubscriberPayment') && subscriber.includes("useState<number | ''>('')"), 'Subscriber payment/input guards failed');
must(paymentModal.includes('getSubscriberOutstanding'), 'Payment modal remaining-debt guard failed');
must(receipt.includes('المسدد سابقاً') && receipt.includes('المتبقي بعد الدفعة'), 'Receipt breakdown guard failed');
must(dashboard.includes('getInvoiceRemaining(inv)'), 'Dashboard partial debt guard failed');
must(pos.includes('applySubscriberPayment(sub, pricingTiers'), 'POS payment execution guard failed');

console.log('Applied reliable partial/final payments, historical receipt reprints, remaining-debt dashboard totals, blank amperes input and numeric phone keyboards.');

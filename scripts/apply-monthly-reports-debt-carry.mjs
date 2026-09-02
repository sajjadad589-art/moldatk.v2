import fs from 'node:fs';

const modalFile = 'src/components/SubscriberModal.tsx';
if (fs.existsSync(modalFile)) {
  let text = fs.readFileSync(modalFile, 'utf8');
  if (!text.includes("from '../utils/monthlyAccounting'")) {
    text = text.replace(
      "import { formatCurrency } from '../utils/formatters';",
      "import { formatCurrency } from '../utils/formatters';\nimport { applyPaymentOldestFirst, ensureCurrentMonthInvoice, getInvoiceRemaining, getMonthId, getSubscriberDebt } from '../utils/monthlyAccounting';"
    );
  }

  text = text.replace(
    "      amountDue: currentCalc.total,\n      amountPaid: subscriberToEdit ? (subscriberToEdit.paymentStatus === 'paid' ? currentCalc.total : (subscriberToEdit.amountPaid || 0)) : 0,",
    "      amountDue: subscriberToEdit ? currentCalc.total + getSubscriberDebt(subscriberToEdit, getMonthId()) : currentCalc.total,\n      amountPaid: subscriberToEdit ? (subscriberToEdit.amountPaid || 0) : 0,"
  );

  text = text.replace(
    /  const handleQuickPayment = \(\) => \{[\s\S]*?\n  \};\n\n  const handleCustomPayment =/,
`  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;

    const ensured = ensureCurrentMonthInvoice(subscriberToEdit, pricingTiers);
    const totalOutstanding = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    if (totalOutstanding <= 0) {
      setIsConfirmUnpaidOpen(true);
      return;
    }

    const allocation = applyPaymentOldestFirst(subscriberToEdit, pricingTiers, totalOutstanding);
    const currentMonthId = getMonthId();
    const receiptInvoice = allocation.invoices.find(inv => inv.monthId === currentMonthId && inv.status !== 'cancelled');
    const updated: Subscriber = {
      ...subscriberToEdit,
      amountDue: allocation.totalDebtAfter,
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      amountPaid: totalOutstanding,
      lastPaymentDate: new Date().toISOString(),
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
    };

    onSaveSubscriber(updated);
    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment', title: 'تسديد كامل مع ترحيل الديون',
        details: \`تم تسديد الأقدم أولاً للمشترك "\${subscriberToEdit.fullName}" بمبلغ \${totalOutstanding}\`,
        entityId: subscriberToEdit.id, entityName: \`\${subscriberToEdit.fullName} (\${subscriberToEdit.code})\`,
        actorName: 'الإدارة العامة', amount: totalOutstanding,
      });
    }
    if (onOpenReceiptModal && receiptInvoice) onOpenReceiptModal(updated, receiptInvoice);
    else onClose();
  };

  const handleCustomPayment =`
  );

  text = text.replace(
    /  const handleCustomPayment = \(status: 'paid' \| 'partial' \| 'free', paidAmount: number = 0\) => \{[\s\S]*?\n  \};\n\n  const formatNum =/,
`  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
    if (!subscriberToEdit) return;

    const currentMonthId = getMonthId();
    let invoices = ensureCurrentMonthInvoice(subscriberToEdit, pricingTiers).invoices.map(inv => ({ ...inv }));
    let totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const finalPaid = status === 'free' ? 0 : Math.max(0, Number(paidAmount || 0));

    if (status === 'free') {
      invoices = invoices.map(inv => inv.monthId === currentMonthId && inv.status !== 'cancelled'
        ? { ...inv, status: 'free' as const, paidAmount: 0, remainingAmount: 0, notes: 'إعفاء مجاني للشهر الحالي' }
        : inv);
      totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    } else {
      const allocation = applyPaymentOldestFirst({ ...subscriberToEdit, invoicesHistory: invoices }, pricingTiers, finalPaid);
      invoices = allocation.invoices;
      totalDebtAfter = allocation.totalDebtAfter;
    }

    const receiptInvoice = invoices.find(inv => inv.monthId === currentMonthId && inv.status !== 'cancelled');
    const updated: Subscriber = {
      ...subscriberToEdit,
      amountDue: totalDebtAfter,
      paymentStatus: status === 'free' && totalDebtAfter === 0 ? 'free' : totalDebtAfter === 0 ? 'paid' : finalPaid > 0 ? 'partial' : 'unpaid',
      amountPaid: finalPaid,
      lastPaymentDate: status === 'free' ? subscriberToEdit.lastPaymentDate : new Date().toISOString(),
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
    };

    onSaveSubscriber(updated);
    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment',
        title: status === 'partial' ? 'تسديد جزئي' : status === 'free' ? 'إعفاء مجاني' : 'تسديد',
        details: \`تسجيل دفعة للمشترك "\${subscriberToEdit.fullName}" بمبلغ \${finalPaid} مع تسديد الديون الأقدم أولاً\`,
        entityId: subscriberToEdit.id, entityName: \`\${subscriberToEdit.fullName} (\${subscriberToEdit.code})\`,
        actorName: 'الإدارة العامة', amount: finalPaid,
      });
    }
    if (onOpenReceiptModal && receiptInvoice) onOpenReceiptModal(updated, receiptInvoice);
    else onClose();
  };

  const formatNum =`
  );

  fs.writeFileSync(modalFile, text);
}

const posFile = 'src/components/POSQuickView.tsx';
if (fs.existsSync(posFile)) {
  let text = fs.readFileSync(posFile, 'utf8');
  if (!text.includes("from '../utils/monthlyAccounting'")) {
    text = text.replace(
      "import { calculateSubscriberBill } from '../utils/formatters';",
      "import { calculateSubscriberBill } from '../utils/formatters';\nimport { getMonthId, getMonthNameAr, getSubscriberDebt } from '../utils/monthlyAccounting';"
    );
  }
  text = text.replace("      monthId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,", "      monthId: getMonthId(now),");
  text = text.replace("      monthNameAr: `شهر ${now.getMonth() + 1} (${now.toLocaleDateString('ar-IQ-u-nu-latn', { month: 'long', year: 'numeric' })})`,", "      monthNameAr: getMonthNameAr(now),");
  text = text.replace("    const totalAmount = sub.amountDue > 0 ? sub.amountDue : calc.total;", "    const carriedDebt = getSubscriberDebt(sub, getMonthId());\n    const totalAmount = Math.max(sub.amountDue || 0, calc.total + carriedDebt);");
  fs.writeFileSync(posFile, text);
}

console.log('Monthly reports and subscriber debt carry-forward applied');

import fs from 'node:fs';

const appFile = 'src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');

if (!app.includes("from './utils/monthlyAccounting'")) {
  app = app.replace(
    "import { calculateSubscriberBill } from './utils/formatters';",
    "import { calculateSubscriberBill } from './utils/formatters';\nimport { calculateMonthlyCharge, getInvoiceRemaining } from './utils/monthlyAccounting';"
  );
}

const replacement = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const previousActiveRecord = monthlyTariffs.find(record => record.isCurrentActive) || monthlyTariffs[0];
    const normalized = updatedTariffs.map(record => ({
      ...record,
      isCurrentActive: record.id === activeMonthId,
    }));

    setMonthlyTariffs(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}

    const activeRecord = normalized.find(m => m.id === activeMonthId) || normalized[0];

    if (shouldRecalculateBills && activeRecord) {
      setSubscribers(prev => {
        const recalculated = prev.map(sub => {
          const isFree = sub.paymentStatus === 'free' || sub.tier === 'free' || sub.isExempted;
          const history = [...(sub.invoicesHistory || [])].map(inv => ({ ...inv }));

          if (previousActiveRecord && previousActiveRecord.id !== activeRecord.id && !history.some(inv => inv.monthId === previousActiveRecord.id && inv.status !== 'cancelled')) {
            const previousCharge = calculateMonthlyCharge(sub, previousActiveRecord.tiers);
            const previousTotal = isFree ? 0 : previousCharge.total;
            const previousPaid = isFree
              ? 0
              : sub.paymentStatus === 'paid'
              ? previousTotal
              : sub.paymentStatus === 'partial'
              ? Math.min(previousTotal, Math.max(0, Number(sub.amountPaid || 0)))
              : 0;
            const previousRemaining = Math.max(0, previousTotal - previousPaid);
            history.push({
              id: 'inv-' + previousActiveRecord.id + '-' + sub.id,
              subscriberId: sub.id,
              receiptNumber: 'ACC-' + previousActiveRecord.id + '-' + (sub.code || sub.subscriberCode || sub.id),
              monthId: previousActiveRecord.id,
              monthNameAr: previousActiveRecord.monthNameAr,
              issueDate: previousActiveRecord.createdAt || new Date().toISOString().slice(0, 10),
              paymentDate: previousPaid > 0 ? sub.lastPaymentDate : undefined,
              amperes: sub.amperes,
              tier: sub.tier,
              pricePerAmpere: previousCharge.pricePerAmpere,
              fixedFee: previousCharge.fixedFee,
              totalAmount: previousTotal,
              paidAmount: previousPaid,
              remainingAmount: previousRemaining,
              status: isFree ? 'free' : previousRemaining === 0 ? 'paid' : previousPaid > 0 ? 'partial' : 'unpaid',
            });
          }

          const charge = calculateMonthlyCharge(sub, activeRecord.tiers);
          let currentInvoice = history.find(inv => inv.monthId === activeRecord.id && inv.status !== 'cancelled');

          if (!currentInvoice) {
            const previousDebt = history
              .filter(inv => inv.monthId < activeRecord.id)
              .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
            currentInvoice = {
              id: 'inv-' + activeRecord.id + '-' + sub.id,
              subscriberId: sub.id,
              receiptNumber: 'ACC-' + activeRecord.id + '-' + (sub.code || sub.subscriberCode || sub.id),
              monthId: activeRecord.id,
              monthNameAr: activeRecord.monthNameAr,
              issueDate: new Date().toISOString().slice(0, 10),
              amperes: sub.amperes,
              tier: sub.tier,
              pricePerAmpere: charge.pricePerAmpere,
              fixedFee: charge.fixedFee,
              totalAmount: isFree ? 0 : charge.total,
              paidAmount: 0,
              remainingAmount: isFree ? 0 : charge.total,
              status: isFree ? 'free' : 'unpaid',
              notes: previousDebt > 0 ? 'دين مرحل من أشهر سابقة: ' + previousDebt : undefined,
            };
            history.push(currentInvoice);
          } else if (currentInvoice.status !== 'paid' && currentInvoice.status !== 'free') {
            const alreadyPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));
            currentInvoice.pricePerAmpere = charge.pricePerAmpere;
            currentInvoice.fixedFee = charge.fixedFee;
            currentInvoice.totalAmount = isFree ? 0 : charge.total;
            currentInvoice.paidAmount = isFree ? 0 : Math.min(alreadyPaid, charge.total);
            currentInvoice.remainingAmount = isFree ? 0 : Math.max(0, charge.total - currentInvoice.paidAmount);
            currentInvoice.status = isFree ? 'free' : currentInvoice.remainingAmount === 0 ? 'paid' : currentInvoice.paidAmount > 0 ? 'partial' : 'unpaid';
          }

          const totalOutstanding = history.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
          const currentRemaining = getInvoiceRemaining(currentInvoice);
          const currentPaid = Number(currentInvoice.paidAmount || 0);

          return {
            ...sub,
            invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
            amountDue: totalOutstanding,
            amountPaid: currentPaid,
            paymentStatus: isFree && totalOutstanding === 0
              ? 'free'
              : currentRemaining === 0 && totalOutstanding === 0
              ? 'paid'
              : currentPaid > 0
              ? 'partial'
              : 'unpaid',
            lastPaymentDate: currentPaid > 0 ? currentInvoice.paymentDate || sub.lastPaymentDate : undefined,
          };
        });

        try {
          localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(recalculated));
          window.dispatchEvent(new Event('moldatk-local-sync'));
        } catch (e) {}

        return recalculated;
      });
    }

    addAuditLog({
      category: 'pricing',
      title: 'تعديل تسعيرة الأمبير',
      details: 'تم حفظ وتطبيق تسعيرة ' + (activeRecord?.monthNameAr || 'الشهر الحالي') + ' على حسابات المشتركين',
      entityName: activeRecord?.monthNameAr || 'تسعيرة الشهر',
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(shouldRecalculateBills ? 'تم حفظ التسعيرة وتحديث حسابات المشتركين للشهر الجديد' : 'تم حفظ تسعيرة الشهر الجديد');
  };
`;

const pattern = /  const handleSaveMonthlyTariffs = \(updatedTariffs: MonthlyTariffRecord\[], activeMonthId: string, shouldRecalculateBills: boolean\) => \{[\s\S]*?\n  \};\n\n  const handleOpenFolderModal/;
if (!pattern.test(app)) throw new Error('handleSaveMonthlyTariffs block not found');
app = app.replace(pattern, replacement + '\n  const handleOpenFolderModal');

fs.writeFileSync(appFile, app);
console.log('Applied active monthly tariff to subscriber balances, statuses, history, and carried debt');

await import('./apply-sync-status-stability-fix.mjs');
await import('./apply-offline-pending-local-first-fix.mjs');
await import('./apply-tariff-sync-dedupe-fix.mjs');
await import('./apply-wallet-authoritative-sync-fix.mjs');
await import('./apply-collector-account-save-login-fix.mjs');

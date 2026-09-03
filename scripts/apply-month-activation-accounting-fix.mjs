import fs from 'node:fs';

const appFile = 'src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');

if (!app.includes("from './utils/monthlyAccounting'")) {
  app = app.replace(
    "import { calculateSubscriberBill } from './utils/formatters';",
    "import { calculateSubscriberBill } from './utils/formatters';\nimport { activateMonthlyTariffForSubscribers } from './utils/monthlyAccounting';\nimport { hasPaymentsInMonth, removeUnpaidMonthLedger } from './utils/monthlyTariffDeletion';"
  );
} else {
  if (!app.includes('activateMonthlyTariffForSubscribers')) {
    app = app.replace(
      /import \{([^}]*)\} from '\.\/utils\/monthlyAccounting';/,
      (m, names) => `import { ${String(names).trim()}, activateMonthlyTariffForSubscribers } from './utils/monthlyAccounting';`
    );
  }
  if (!app.includes("from './utils/monthlyTariffDeletion'")) {
    const accountingImport = app.match(/import \{[^}]*\} from '\.\/utils\/monthlyAccounting';/)?.[0];
    if (accountingImport) {
      app = app.replace(
        accountingImport,
        accountingImport + "\nimport { hasPaymentsInMonth, removeUnpaidMonthLedger } from './utils/monthlyTariffDeletion';"
      );
    }
  }
}

const replacement = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const previousActiveRecord = monthlyTariffs.find(record => record.isCurrentActive) || monthlyTariffs[0];
    const normalized = updatedTariffs.map(record => ({
      ...record,
      isCurrentActive: record.id === activeMonthId,
    }));
    const activeRecord = normalized.find(m => m.id === activeMonthId) || normalized[0];
    if (!activeRecord) return;

    const removedActiveMonthId = previousActiveRecord && !normalized.some(record => record.id === previousActiveRecord.id)
      ? previousActiveRecord.id
      : null;

    // مسح شهر نشط مسموح فقط إذا لم يُقبض عليه أي مبلغ. هكذا لا يمكن حذف شهر بعد وجود إيصالات/تسديدات.
    if (removedActiveMonthId && hasPaymentsInMonth(subscribers, removedActiveMonthId)) {
      showToast('لا يمكن مسح تسعيرة هذا الشهر لأن توجد تسديدات مسجلة عليه');
      return;
    }

    setMonthlyTariffs(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
    } catch (e) {}

    if (removedActiveMonthId) {
      setSubscribers(prev => {
        const cleaned = removeUnpaidMonthLedger(prev, removedActiveMonthId, activeRecord.id);
        try {
          localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(cleaned));
        } catch (e) {}
        return cleaned;
      });
    } else if (shouldRecalculateBills) {
      setSubscribers(prev => {
        const recalculated = activateMonthlyTariffForSubscribers(prev, previousActiveRecord, activeRecord, new Date());
        try {
          localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(recalculated));
        } catch (e) {}
        return recalculated;
      });
    }

    // لا نطلق تحديث الواجهة/المزامنة إلا بعد حفظ التسعيرة وحسابات المشتركين محلياً،
    // حتى لا ترى عملية السحب شهراً جديداً قبل أن تنشأ فواتيره.
    queueMicrotask(() => window.dispatchEvent(new Event('moldatk-local-sync')));

    addAuditLog({
      category: 'pricing',
      title: removedActiveMonthId
        ? 'مسح تسعيرة الشهر الحالي'
        : shouldRecalculateBills
        ? 'تفعيل تسعيرة شهر جديد'
        : 'تعديل سجل التسعيرة',
      details: removedActiveMonthId
        ? 'تم مسح التسعيرة غير المسددة ' + removedActiveMonthId + ' والرجوع إلى ' + (activeRecord.monthNameAr || activeRecord.id)
        : shouldRecalculateBills
        ? 'تم تفعيل ' + (activeRecord.monthNameAr || activeRecord.id) + ' وإنشاء استحقاق مستقل لكل مشترك مع ترحيل الديون السابقة'
        : 'تم حفظ سجل ' + (activeRecord.monthNameAr || activeRecord.id),
      entityName: activeRecord.monthNameAr || activeRecord.id,
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(removedActiveMonthId
      ? 'تم مسح تسعيرة الشهر الحالي والرجوع للشهر السابق'
      : shouldRecalculateBills
      ? 'تم تفعيل الشهر الجديد وإضافة الاستحقاقات وترحيل الديون'
      : 'تم حفظ التسعيرة');
  };
`;

const pattern = /  const handleSaveMonthlyTariffs = \(updatedTariffs: MonthlyTariffRecord\[], activeMonthId: string, shouldRecalculateBills: boolean\) => \{[\s\S]*?\n  \};\n\n  const handleOpenFolderModal/;
if (!pattern.test(app)) throw new Error('handleSaveMonthlyTariffs block not found');
app = app.replace(pattern, replacement + '\n  const handleOpenFolderModal');

fs.writeFileSync(appFile, app);
console.log('Applied tested monthly rollover engine: current-month reset, carried debt, safe deletion, and synchronized persistence');

await import('./apply-sync-status-stability-fix.mjs');
await import('./apply-offline-pending-local-first-fix.mjs');
await import('./apply-tariff-sync-dedupe-fix.mjs');
await import('./apply-wallet-authoritative-sync-fix.mjs');
await import('./apply-collector-account-save-login-fix.mjs');
await import('./apply-monthly-ledger-finalization.mjs');
await import('./apply-monthly-ledger-typecheck-fixes.mjs');
await import('./apply-dashboard-current-month-status-fix.mjs');
await import('./apply-desktop-reports-pricing-editor-fix.mjs');

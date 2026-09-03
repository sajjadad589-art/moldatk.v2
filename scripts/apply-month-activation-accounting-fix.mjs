import fs from 'node:fs';

const appFile = 'src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');

if (!app.includes("from './utils/monthlyAccounting'")) {
  app = app.replace(
    "import { calculateSubscriberBill } from './utils/formatters';",
    "import { calculateSubscriberBill } from './utils/formatters';\nimport { activateMonthlyTariffForSubscribers } from './utils/monthlyAccounting';"
  );
} else if (!app.includes('activateMonthlyTariffForSubscribers')) {
  app = app.replace(
    /import \{([^}]*)\} from '\.\/utils\/monthlyAccounting';/,
    (m, names) => `import { ${String(names).trim()}, activateMonthlyTariffForSubscribers } from './utils/monthlyAccounting';`
  );
}

const replacement = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const previousActiveRecord = monthlyTariffs.find(record => record.isCurrentActive) || monthlyTariffs[0];
    const normalized = updatedTariffs.map(record => ({
      ...record,
      isCurrentActive: record.id === activeMonthId,
    }));
    const activeRecord = normalized.find(m => m.id === activeMonthId) || normalized[0];
    if (!activeRecord) return;

    setMonthlyTariffs(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
    } catch (e) {}

    if (shouldRecalculateBills) {
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
      title: shouldRecalculateBills ? 'تفعيل تسعيرة شهر جديد' : 'تعديل سجل التسعيرة',
      details: shouldRecalculateBills
        ? 'تم تفعيل ' + (activeRecord.monthNameAr || activeRecord.id) + ' وإنشاء استحقاق مستقل لكل مشترك مع ترحيل الديون السابقة'
        : 'تم حفظ سجل ' + (activeRecord.monthNameAr || activeRecord.id),
      entityName: activeRecord.monthNameAr || activeRecord.id,
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(shouldRecalculateBills
      ? 'تم تفعيل الشهر الجديد وإضافة الاستحقاقات وترحيل الديون'
      : 'تم حفظ التسعيرة');
  };
`;

const pattern = /  const handleSaveMonthlyTariffs = \(updatedTariffs: MonthlyTariffRecord\[], activeMonthId: string, shouldRecalculateBills: boolean\) => \{[\s\S]*?\n  \};\n\n  const handleOpenFolderModal/;
if (!pattern.test(app)) throw new Error('handleSaveMonthlyTariffs block not found');
app = app.replace(pattern, replacement + '\n  const handleOpenFolderModal');

fs.writeFileSync(appFile, app);
console.log('Applied tested monthly rollover engine: current-month reset, carried debt, and synchronized persistence');

await import('./apply-sync-status-stability-fix.mjs');
await import('./apply-offline-pending-local-first-fix.mjs');
await import('./apply-tariff-sync-dedupe-fix.mjs');
await import('./apply-wallet-authoritative-sync-fix.mjs');
await import('./apply-collector-account-save-login-fix.mjs');
await import('./apply-monthly-ledger-finalization.mjs');
await import('./apply-monthly-ledger-typecheck-fixes.mjs');
await import('./apply-dashboard-current-month-status-fix.mjs');
await import('./apply-desktop-reports-pricing-editor-fix.mjs');

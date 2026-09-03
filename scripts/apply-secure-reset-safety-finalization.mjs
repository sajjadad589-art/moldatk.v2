import fs from 'node:fs';

const p = 'src/App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Deleting an active tariff must be allowed even when payments exist, but paid accounting history
// must never be removed. Only an unpaid month ledger may be rolled back together with its tariff.
const blocker = `    if (removedActiveMonthId && hasPaymentsInMonth(subscribers, removedActiveMonthId)) {\n      showToast('لا يمكن مسح تسعيرة هذا الشهر لأن توجد تسديدات مسجلة عليه');\n      return;\n    }\n\n    let nextSubscribers = subscribers;\n    if (removedActiveMonthId) {\n      nextSubscribers = removeUnpaidMonthLedger(subscribers, removedActiveMonthId, activeRecord.id);\n    } else if (shouldRecalculateBills) {`;
const allowed = `    const removedActiveMonthHasPayments = Boolean(\n      removedActiveMonthId && hasPaymentsInMonth(subscribers, removedActiveMonthId)\n    );\n\n    let nextSubscribers = subscribers;\n    if (removedActiveMonthId && !removedActiveMonthHasPayments) {\n      nextSubscribers = removeUnpaidMonthLedger(subscribers, removedActiveMonthId, activeRecord.id);\n    } else if (!removedActiveMonthId && shouldRecalculateBills) {`;
if (c.includes(blocker)) c = c.replace(blocker, allowed);
else if (!c.includes('removedActiveMonthHasPayments')) throw new Error('Active tariff delete safety block not found');

// Keep a second emergency backup in localStorage in addition to the downloaded JSON file.
// The SAFE suffix intentionally prevents the generator-scoped cleanup from deleting this backup.
if (!c.includes('moldatk_emergency_backup_last_')) {
  const blobLine = `      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });`;
  const backedUp = `      try {\n        localStorage.setItem('moldatk_emergency_backup_last_' + generatorId + '_SAFE', JSON.stringify(backup));\n      } catch (backupError) {\n        console.warn('Could not keep local emergency backup:', backupError);\n      }\n      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });`;
  if (!c.includes(blobLine)) throw new Error('Secure backup insertion point not found');
  c = c.replace(blobLine, backedUp);
}

fs.writeFileSync(p, c);
console.log('Finalized secure reset: delete-any-tariff preserves paid ledgers and emergency backup has two copies');

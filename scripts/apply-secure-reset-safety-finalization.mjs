import fs from 'node:fs';

const p = 'src/App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Deleting an active tariff must be allowed even when payments exist, but paid accounting history
// must never be removed. Only an unpaid month ledger may be rolled back together with its tariff.
if (!c.includes('removedActiveMonthHasPayments')) {
  const re = /    if \(removedActiveMonthId && hasPaymentsInMonth\(subscribers, removedActiveMonthId\)\) \{[\s\S]*?    let nextSubscribers = subscribers;\s*    if \(removedActiveMonthId\) \{\s*      nextSubscribers = removeUnpaidMonthLedger\(subscribers, removedActiveMonthId, activeRecord\.id\);\s*    \} else if \(shouldRecalculateBills\) \{/;
  const allowed = `    const removedActiveMonthHasPayments = Boolean(\n      removedActiveMonthId && hasPaymentsInMonth(subscribers, removedActiveMonthId)\n    );\n\n    let nextSubscribers = subscribers;\n    if (removedActiveMonthId && !removedActiveMonthHasPayments) {\n      nextSubscribers = removeUnpaidMonthLedger(subscribers, removedActiveMonthId, activeRecord.id);\n    } else if (!removedActiveMonthId && shouldRecalculateBills) {`;
  if (!re.test(c)) {
    const start = c.indexOf('    if (removedActiveMonthId && hasPaymentsInMonth(subscribers, removedActiveMonthId))');
    const endNeedle = '      nextSubscribers = activateMonthlyTariffForSubscribers(subscribers, previousActiveRecord, activeRecord, new Date());';
    const end = start >= 0 ? c.indexOf(endNeedle, start) : -1;
    if (start < 0 || end < 0) throw new Error('Active tariff delete safety block not found');
    const prefix = c.slice(0, start);
    const suffixStart = c.indexOf('\n', end + endNeedle.length);
    if (suffixStart < 0) throw new Error('Active tariff delete safety block end not found');
    c = prefix + allowed + '\n      nextSubscribers = activateMonthlyTariffForSubscribers(subscribers, previousActiveRecord, activeRecord, new Date());' + c.slice(suffixStart);
  } else {
    c = c.replace(re, allowed);
  }
}

// Keep a second emergency backup in localStorage in addition to the downloaded JSON file.
// The SAFE suffix intentionally prevents the generator-scoped cleanup from deleting this backup.
if (!c.includes('moldatk_emergency_backup_last_')) {
  const blobRe = /\s*const blob = new Blob\(\[JSON\.stringify\(backup, null, 2\)\], \{ type: 'application\/json;charset=utf-8' \}\);/;
  const match = c.match(blobRe);
  if (!match) throw new Error('Secure backup insertion point not found');
  const backedUp = `\n      try {\n        localStorage.setItem('moldatk_emergency_backup_last_' + generatorId + '_SAFE', JSON.stringify(backup));\n      } catch (backupError) {\n        console.warn('Could not keep local emergency backup:', backupError);\n      }\n      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });`;
  c = c.replace(blobRe, backedUp);
}

fs.writeFileSync(p, c);
console.log('Finalized secure reset: delete-any-tariff preserves paid ledgers and emergency backup has two copies');

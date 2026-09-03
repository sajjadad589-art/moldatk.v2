import fs from 'node:fs';

const p = 'src/App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Tariff deletion is intentionally metadata-only after the final monthly-ledger patch.
// PricingModal sends shouldRecalculateBills=false; App saves the remaining tariff records and
// NEVER removes subscriber invoices/debts here. This lets the owner delete any tariff while
// preserving all paid/unpaid accounting history and receipts for audit/reporting.
if (!c.includes("showToast(shouldRecalculateBills")) {
  throw new Error('Final monthly tariff persistence handler not found');
}

// Keep a second emergency backup in localStorage in addition to the downloaded JSON file.
// The SAFE suffix intentionally prevents generator-scoped cleanup from deleting this backup.
if (!c.includes('moldatk_emergency_backup_last_')) {
  const blobRe = /\s*const blob = new Blob\(\[JSON\.stringify\(backup, null, 2\)\], \{ type: 'application\/json;charset=utf-8' \}\);/;
  const match = c.match(blobRe);
  if (!match) throw new Error('Secure backup insertion point not found');
  const backedUp = `\n      try {\n        localStorage.setItem('moldatk_emergency_backup_last_' + generatorId + '_SAFE', JSON.stringify(backup));\n      } catch (backupError) {\n        console.warn('Could not keep local emergency backup:', backupError);\n      }\n      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });`;
  c = c.replace(blobRe, backedUp);
}

fs.writeFileSync(p, c);
console.log('Finalized secure reset: delete-any-tariff is metadata-only and emergency backup has two copies');

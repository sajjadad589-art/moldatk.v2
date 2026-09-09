import fs from 'node:fs';

const path = 'scripts/apply-discount-dashboard-boxes-final.mjs';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const badTemplate = "  return \\`${year}-\\${String(month).padStart(2, '0')}\\`;";
const goodTemplate = "  return year + '-' + String(month).padStart(2, '0');";
if (source.includes(badTemplate)) {
  source = source.replace(badTemplate, goodTemplate);
  changed = true;
}

const oldMobileAnchor = "    const summaryAnchor = '  const currentMonthTotal = dashboardSummary.monthTotal;';";
const newMobileAnchor = "    const summaryAnchor = '  const currentMonthTotal = billingCycleActive ? dashboardSummary.monthTotal : 0;';";
if (source.includes(oldMobileAnchor)) {
  source = source.replace(oldMobileAnchor, newMobileAnchor);
  changed = true;
}

const oldDesktopAnchor = "    const summaryAnchor = '  const totalCollectedRevenue = reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId);';";
const newDesktopAnchor = "    const summaryAnchor = `  const totalCollectedRevenue = billingCycleActive\n    ? reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)\n    : 0;`;";
if (source.includes(oldDesktopAnchor)) {
  source = source.replace(oldDesktopAnchor, newDesktopAnchor);
  changed = true;
}

if (!source.includes(goodTemplate)) throw new Error('Discount dashboard previousMonthId generator repair missing.');
if (!source.includes(newMobileAnchor)) throw new Error('Discount dashboard mobile authoritative anchor repair missing.');
if (!source.includes(newDesktopAnchor)) throw new Error('Discount dashboard desktop authoritative anchor repair missing.');

if (changed) {
  fs.writeFileSync(path, source, 'utf8');
  console.log('Discount dashboard finalizer repaired for current authoritative layout.');
} else {
  console.log('Discount dashboard finalizer already matches current authoritative layout.');
}

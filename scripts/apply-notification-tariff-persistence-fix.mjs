import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Save and ACTIVATE a newly-created month immediately.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);
  const old = `    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    setIsAddingNewMonth(false);\n  };`;
  const next = `    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    // الشهر الجديد ليس شكلياً: احفظه وابدأ دورة الحساب الجديدة فوراً.\n    onSaveMonthlyTariffs(updatedTariffs, monthId, true);\n    setIsAddingNewMonth(false);\n  };`;
  if (c.includes(old)) c = c.replace(old, next);
  else if (c.includes('onSaveMonthlyTariffs(updatedTariffs, monthId, false);')) {
    c = c.replace('onSaveMonthlyTariffs(updatedTariffs, monthId, false);', 'onSaveMonthlyTariffs(updatedTariffs, monthId, true);');
  } else if (!c.includes('onSaveMonthlyTariffs(updatedTariffs, monthId, true);')) {
    throw new Error('PricingModal create-month block not found');
  }
  write(p, c);
}

// 2) Monthly tariff history is append/update history, not a mirror-delete table.
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = read(p);

  c = c.replace(
    "          await replaceMissingRows('generator_monthly_tariffs', generatorId, tariffs.map(t => t.id));",
    "          // لا نحذف أشهر التسعيرة التاريخية من السحابة عند مزامنة Snapshot محلي ناقص."
  );

  const oldWrite = "        writeLocal(localKeys.tariffs, (tariffs.data || []).map(rowToTariff));";
  const mergedWrite = `        const remoteTariffs = (tariffs.data || []).map(rowToTariff);\n        const remoteTariffIds = new Set(remoteTariffs.map(t => t.id));\n        const pendingLocalTariffs = localTariffs.filter(t => !remoteTariffIds.has(t.id));\n        const hasPendingLocalTariffs = pendingLocalTariffs.length > 0;\n        const localPendingActive = pendingLocalTariffs.some(t => t.isCurrentActive);\n        const mergedTariffs = [\n          ...pendingLocalTariffs,\n          ...remoteTariffs.map(t => localPendingActive ? { ...t, isCurrentActive: false } : t),\n        ].sort((a, b) => (b.year - a.year) || (b.month - a.month));\n        writeLocal(localKeys.tariffs, mergedTariffs);`;
  if (c.includes(oldWrite)) c = c.replace(oldWrite, mergedWrite);
  else if (!c.includes('const pendingLocalTariffs = localTariffs.filter')) {
    throw new Error('Cloud tariff pull block not found');
  }

  const oldTail = `        window.dispatchEvent(new Event('moldatk-local-sync'));\n        lastSnapshot.current = snapshot();\n        ready.current = true;`;
  const nextTail = `        window.dispatchEvent(new Event('moldatk-local-sync'));\n        ready.current = true;\n        if (hasPendingLocalTariffs && session?.role === 'generator_admin') {\n          await push();\n        }\n        lastSnapshot.current = snapshot();`;
  if (c.includes(oldTail)) c = c.replace(oldTail, nextTail);
  else if (!c.includes("if (hasPendingLocalTariffs && session?.role === 'generator_admin')")) {
    throw new Error('Cloud pull completion block not found');
  }

  write(p, c);
}

console.log('Applied tariff persistence: immediate month activation + non-destructive history sync');

import fs from 'node:fs';

const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = fs.readFileSync(syncPath, 'utf8');
let syncChanged = false;

const tariffRead = "        const tariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);";
const tariffReadNew = `        const rawTariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);\n        const tariffMap = new Map<string, MonthlyTariffRecord>();\n        for (const tariff of rawTariffs) tariffMap.set(tariff.id, tariff);\n        const tariffs = Array.from(tariffMap.values());\n        if (tariffs.length !== rawTariffs.length) {\n          writeLocal(localKeys.tariffs, tariffs);\n        }`;
if (sync.includes(tariffRead)) {
  sync = sync.replace(tariffRead, tariffReadNew);
  syncChanged = true;
}

// Defensive guard: never send duplicate conflict keys to Postgres upsert.
const tariffUpsert = "            const { error } = await supabase.from('generator_monthly_tariffs').upsert(tariffs.map(t => tariffToRow(generatorId, t)), { onConflict: 'generator_id,id' });";
const tariffUpsertNew = "            const uniqueTariffs = Array.from(new Map(tariffs.map(t => [t.id, t] as const)).values());\n            const { error } = await supabase.from('generator_monthly_tariffs').upsert(uniqueTariffs.map(t => tariffToRow(generatorId, t)), { onConflict: 'generator_id,id' });";
if (sync.includes(tariffUpsert)) {
  sync = sync.replace(tariffUpsert, tariffUpsertNew);
  syncChanged = true;
}

if (syncChanged) fs.writeFileSync(syncPath, sync);

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
let appChanged = false;

const normalizedBlock = `    const normalized = updatedTariffs.map(record => ({\n      ...record,\n      isCurrentActive: record.id === activeMonthId,\n    }));`;
const normalizedBlockNew = `    const uniqueTariffMap = new Map<string, MonthlyTariffRecord>();\n    for (const record of updatedTariffs) uniqueTariffMap.set(record.id, record);\n    const normalized = Array.from(uniqueTariffMap.values()).map(record => ({\n      ...record,\n      isCurrentActive: record.id === activeMonthId,\n    }));`;
if (app.includes(normalizedBlock)) {
  app = app.replace(normalizedBlock, normalizedBlockNew);
  appChanged = true;
}

if (appChanged) fs.writeFileSync(appPath, app);

console.log('Applied tariff de-duplication before local save and cloud upsert');

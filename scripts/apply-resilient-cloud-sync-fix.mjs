import fs from 'node:fs';

const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = fs.readFileSync(syncPath, 'utf8');
let changed = false;

const writeMarker = "function writeLocal(storageKey: string, value: unknown) {\n  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {}\n}";
const writeReplacement = `${writeMarker}\n\nfunction emitSyncProgress(detail: { active?: boolean; progress?: number; message?: string; pending?: boolean }) {\n  try { window.dispatchEvent(new CustomEvent('moldatk-sync-progress', { detail })); } catch {}\n}`;
if (!sync.includes('function emitSyncProgress(')) {
  if (!sync.includes(writeMarker)) throw new Error('writeLocal marker not found');
  sync = sync.replace(writeMarker, writeReplacement);
  changed = true;
}

for (const line of [
  "        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));\n",
  "        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));\n",
  "          await replaceMissingRows('generator_lines', generatorId, lines.map(l => l.id));\n",
  "          await replaceMissingRows('generator_monthly_tariffs', generatorId, tariffs.map(t => t.id));\n",
]) {
  if (sync.includes(line)) {
    sync = sync.replace(line, '');
    changed = true;
  }
}

const pushStart = "    const push = async () => {\n      if (!ready.current || pushing.current || disposed) return;\n      pushing.current = true;\n      try {";
const pushStartNew = "    const push = async () => {\n      if (!ready.current || pushing.current || disposed) return;\n      if (typeof navigator !== 'undefined' && !navigator.onLine) {\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بانتظار رجوع الإنترنت للمزامنة' });\n        return;\n      }\n      pushing.current = true;\n      emitSyncProgress({ active: true, progress: 5, message: 'جاري المزامنة' });\n      try {";
if (sync.includes(pushStart)) {
  sync = sync.replace(pushStart, pushStartNew);
  changed = true;
}

const subsBlock = "        if (subscribers.length) {\n          const { error } = await supabase.from('generator_subscribers').upsert(subscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }";
const subsBlockNew = `${subsBlock}\n        emitSyncProgress({ active: true, progress: 30, message: 'مزامنة المشتركين' });`;
if (sync.includes(subsBlock) && !sync.includes("progress: 30, message: 'مزامنة المشتركين'")) {
  sync = sync.replace(subsBlock, subsBlockNew);
  changed = true;
}

const invoiceBlock = "        if (invoices.length) {\n          const { error } = await supabase.from('generator_invoices').upsert(invoices.map(i => invoiceToRow(generatorId, i)), { onConflict: 'generator_id,id' });\n          if (error) throw error;\n        }";
const invoiceBlockNew = `${invoiceBlock}\n        emitSyncProgress({ active: true, progress: 55, message: 'مزامنة التسديدات' });`;
if (sync.includes(invoiceBlock) && !sync.includes("progress: 55, message: 'مزامنة التسديدات'")) {
  sync = sync.replace(invoiceBlock, invoiceBlockNew);
  changed = true;
}

const beforeAudit = "        if (audit.length) {";
if (sync.includes(beforeAudit) && !sync.includes("progress: 80, message: 'مزامنة الإعدادات'")) {
  sync = sync.replace(beforeAudit, "        emitSyncProgress({ active: true, progress: 80, message: 'مزامنة الإعدادات' });\n\n" + beforeAudit);
  changed = true;
}

const lastSnapshotLine = "        lastSnapshot.current = snapshot();";
if (sync.includes(lastSnapshotLine) && !sync.includes("progress: 100, message: 'اكتملت المزامنة'")) {
  sync = sync.replace(lastSnapshotLine, `${lastSnapshotLine}\n        emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });`);
  changed = true;
}

const catchBlock = "      } catch (e) {\n        console.error('Moldatk cloud sync push failed:', e);\n      } finally {";
const catchBlockNew = "      } catch (e) {\n        console.error('Moldatk cloud sync push failed:', e);\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'تعذر الاتصال — ستتم المزامنة تلقائياً' });\n      } finally {";
if (sync.includes(catchBlock)) {
  sync = sync.replace(catchBlock, catchBlockNew);
  changed = true;
}

const pullStart = "    const pull = async (bootstrap = false) => {\n      if (refreshing.current) return;\n      refreshing.current = true;\n      try {";
const pullStartNew = "    const pull = async (bootstrap = false) => {\n      if (refreshing.current) return;\n      if (typeof navigator !== 'undefined' && !navigator.onLine) {\n        ready.current = true;\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'وضع بدون إنترنت — التغييرات محفوظة للمزامنة' });\n        return;\n      }\n      refreshing.current = true;\n      try {";
if (sync.includes(pullStart)) {
  sync = sync.replace(pullStart, pullStartNew);
  changed = true;
}

const bootstrapLine = "    void pull(true).catch(e => console.error('Moldatk cloud sync bootstrap failed:', e));";
const bootstrapNew = "    void pull(true).catch(e => {\n      ready.current = true;\n      console.error('Moldatk cloud sync bootstrap failed:', e);\n      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'البيانات محفوظة محلياً وستتزامن عند رجوع الإنترنت' });\n    });";
if (sync.includes(bootstrapLine)) {
  sync = sync.replace(bootstrapLine, bootstrapNew);
  changed = true;
}

const listenerMarker = "    window.addEventListener('moldatk-local-sync', onLocalChange);\n    const timer = window.setInterval(onLocalChange, 2500);";
const listenerNew = `    const handleOnline = async () => {\n      ready.current = true;\n      emitSyncProgress({ active: true, progress: 1, message: 'عاد الإنترنت — جاري المزامنة' });\n      await push();\n      await pull();\n      emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });\n    };\n    const handleOffline = () => {\n      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بدون إنترنت — سيتم حفظ العمليات للمزامنة' });\n    };\n\n    window.addEventListener('moldatk-local-sync', onLocalChange);\n    window.addEventListener('online', handleOnline);\n    window.addEventListener('offline', handleOffline);\n    const timer = window.setInterval(onLocalChange, 2500);`;
if (sync.includes(listenerMarker) && !sync.includes('const handleOnline = async () =>')) {
  sync = sync.replace(listenerMarker, listenerNew);
  changed = true;
}

const cleanupMarker = "      window.removeEventListener('moldatk-local-sync', onLocalChange);\n      document.removeEventListener('visibilitychange', visibility);";
const cleanupNew = "      window.removeEventListener('moldatk-local-sync', onLocalChange);\n      window.removeEventListener('online', handleOnline);\n      window.removeEventListener('offline', handleOffline);\n      document.removeEventListener('visibilitychange', visibility);";
if (sync.includes(cleanupMarker)) {
  sync = sync.replace(cleanupMarker, cleanupNew);
  changed = true;
}

if (changed) {
  fs.writeFileSync(syncPath, sync);
  console.log('Applied resilient realtime/offline cloud sync fix');
} else {
  console.log('Resilient cloud sync fix already applied');
}

const mainPath = 'src/main.tsx';
let main = fs.readFileSync(mainPath, 'utf8');
let mainChanged = false;
if (!main.includes("import { SyncProgressIndicator } from './components/SyncProgressIndicator';")) {
  main = main.replace(
    "import { AndroidUpdateChecker } from './components/AndroidUpdateChecker';",
    "import { AndroidUpdateChecker } from './components/AndroidUpdateChecker';\nimport { SyncProgressIndicator } from './components/SyncProgressIndicator';"
  );
  mainChanged = true;
}
if (!main.includes('<SyncProgressIndicator />')) {
  main = main.replace('    <AndroidUpdateChecker />', '    <AndroidUpdateChecker />\n    <SyncProgressIndicator />');
  mainChanged = true;
}
if (mainChanged) fs.writeFileSync(mainPath, main);

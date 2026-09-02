import fs from 'node:fs';

const p = 'src/lib/useGeneratorCloudSync.ts';
let c = fs.readFileSync(p, 'utf8');
let changed = false;

// Keep a durable per-generator dirty flag. Any local change is authoritative until a push succeeds.
// Use uniquely named helpers and verify the exact helper block exists inside the hook scope.
const localKeysEnd = `      audit: key('moldatk_audit_logs', generatorId),\n    };`;
const helperBlock = `${localKeysEnd}\n    const localFirstPendingSyncKey = key('moldatk_pending_sync', generatorId);\n    const localFirstHasPendingChanges = () => localStorage.getItem(localFirstPendingSyncKey) === '1';\n    const localFirstMarkPendingChanges = () => { try { localStorage.setItem(localFirstPendingSyncKey, '1'); } catch {} };\n    const localFirstClearPendingChanges = () => { try { localStorage.removeItem(localFirstPendingSyncKey); } catch {} };`;

if (!c.includes(localKeysEnd)) throw new Error('localKeys marker not found for local-first sync guard');
if (!c.includes('const localFirstPendingSyncKey =')) {
  c = c.replace(localKeysEnd, helperBlock);
  changed = true;
}

// Migrate any earlier helper names/calls from a partial patch to the scoped names above.
for (const [from, to] of [
  ['hasPendingLocalChanges()', 'localFirstHasPendingChanges()'],
  ['markPendingLocalChanges()', 'localFirstMarkPendingChanges()'],
  ['clearPendingLocalChanges()', 'localFirstClearPendingChanges()'],
]) {
  if (c.includes(from)) {
    c = c.split(from).join(to);
    changed = true;
  }
}

// Clear the dirty flag only after the complete cloud push has succeeded.
const pushSuccess = `        lastSnapshot.current = snapshot();`;
if (c.includes(pushSuccess) && !c.includes('localFirstClearPendingChanges();\n        lastSnapshot.current = snapshot();')) {
  c = c.replace(pushSuccess, `        localFirstClearPendingChanges();\n${pushSuccess}`);
  changed = true;
}

// If a realtime pull arrives while there are unsynced local edits, push local first.
// Never allow an older cloud snapshot to overwrite the pending local version.
const localReads = `        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);`;
if (c.includes(localReads) && !c.includes('if (localFirstHasPendingChanges()) {\n          ready.current = true;')) {
  c = c.replace(localReads, `${localReads}\n\n        if (localFirstHasPendingChanges()) {\n          ready.current = true;\n          await push();\n          // push keeps the dirty flag on any failure. In that case leave local data untouched.\n          if (localFirstHasPendingChanges()) {\n            emitSyncProgress({ active: false, progress: 0, pending: true, message: 'التعديلات محفوظة على الجهاز وبانتظار المزامنة' });\n            return;\n          }\n        }`);
  changed = true;
}

// Mark the device copy dirty before attempting any upload. The periodic checker also catches
// edits that did not dispatch moldatk-local-sync explicitly.
const localChangeOld = `    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;\n      const next = snapshot();\n      if (next !== lastSnapshot.current) void push();\n    };`;
const localChangeNew = `    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;\n      const next = snapshot();\n      if (next !== lastSnapshot.current) {\n        localFirstMarkPendingChanges();\n        void push();\n      }\n    };`;
if (c.includes(localChangeOld)) {
  c = c.replace(localChangeOld, localChangeNew);
  changed = true;
}

// If another patch already expanded onLocalChange but left the old helper name, normalize it.
if (c.includes('markPendingLocalChanges();')) {
  c = c.split('markPendingLocalChanges();').join('localFirstMarkPendingChanges();');
  changed = true;
}

// On bootstrap, if there were edits saved from a previous offline/pending session, do not pull over them.
const bootstrapCall = `    void pull(true).catch(e => {`;
if (c.includes(bootstrapCall) && !c.includes("if (localFirstHasPendingChanges()) {\n      ready.current = true;\n      void push();")) {
  c = c.replace(bootstrapCall, `    if (localFirstHasPendingChanges()) {\n      ready.current = true;\n      void push();\n    }\n\n${bootstrapCall}`);
  changed = true;
}

if (!c.includes('const localFirstPendingSyncKey =') || !c.includes('const localFirstHasPendingChanges =') || !c.includes('const localFirstMarkPendingChanges =') || !c.includes('const localFirstClearPendingChanges =')) {
  throw new Error('local-first helper injection failed');
}

if (!changed) {
  console.log('Offline pending local-first protection already applied');
} else {
  fs.writeFileSync(p, c);
  console.log('Applied durable local-first pending sync protection');
}

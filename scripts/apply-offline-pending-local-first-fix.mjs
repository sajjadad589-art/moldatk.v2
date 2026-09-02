import fs from 'node:fs';

const p = 'src/lib/useGeneratorCloudSync.ts';
let c = fs.readFileSync(p, 'utf8');
let changed = false;

// Keep a durable per-generator dirty flag. Any local change is authoritative until a push succeeds.
const localKeysEnd = `      audit: key('moldatk_audit_logs', generatorId),\n    };`;
if (c.includes(localKeysEnd) && !c.includes('const pendingSyncKey =')) {
  c = c.replace(localKeysEnd, `${localKeysEnd}\n    const pendingSyncKey = key('moldatk_pending_sync', generatorId);\n    const hasPendingLocalChanges = () => localStorage.getItem(pendingSyncKey) === '1';\n    const markPendingLocalChanges = () => { try { localStorage.setItem(pendingSyncKey, '1'); } catch {} };\n    const clearPendingLocalChanges = () => { try { localStorage.removeItem(pendingSyncKey); } catch {} };`);
  changed = true;
}

// Clear the dirty flag only after the complete cloud push has succeeded.
const pushSuccess = `        lastSnapshot.current = snapshot();`;
if (c.includes(pushSuccess) && !c.includes('clearPendingLocalChanges();\n        lastSnapshot.current = snapshot();')) {
  c = c.replace(pushSuccess, `        clearPendingLocalChanges();\n${pushSuccess}`);
  changed = true;
}

// If a realtime pull arrives while there are unsynced local edits, push local first.
// Never allow an older cloud snapshot to overwrite the pending local version.
const localReads = `        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);`;
if (c.includes(localReads) && !c.includes('if (hasPendingLocalChanges()) {\n          ready.current = true;')) {
  c = c.replace(localReads, `${localReads}\n\n        if (hasPendingLocalChanges()) {\n          ready.current = true;\n          await push();\n          // push keeps the dirty flag on any failure. In that case leave local data untouched.\n          if (hasPendingLocalChanges()) {\n            emitSyncProgress({ active: false, progress: 0, pending: true, message: 'التعديلات محفوظة على الجهاز وبانتظار المزامنة' });\n            return;\n          }\n        }`);
  changed = true;
}

// Mark the device copy dirty before attempting any upload. The periodic checker also catches
// edits that did not dispatch moldatk-local-sync explicitly.
const localChange = `    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;\n      const next = snapshot();\n      if (next !== lastSnapshot.current) void push();\n    };`;
const localChangeNew = `    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;\n      const next = snapshot();\n      if (next !== lastSnapshot.current) {\n        markPendingLocalChanges();\n        void push();\n      }\n    };`;
if (c.includes(localChange)) {
  c = c.replace(localChange, localChangeNew);
  changed = true;
}

// On bootstrap, if there were edits saved from a previous offline/pending session, do not pull over them.
const bootstrapCall = `    void pull(true).catch(e => {`;
if (c.includes(bootstrapCall) && !c.includes("if (hasPendingLocalChanges()) {\n      ready.current = true;\n      void push();")) {
  c = c.replace(bootstrapCall, `    if (hasPendingLocalChanges()) {\n      ready.current = true;\n      void push();\n    }\n\n${bootstrapCall}`);
  changed = true;
}

if (!changed) {
  console.log('Offline pending local-first protection already applied');
} else {
  fs.writeFileSync(p, c);
  console.log('Applied durable local-first pending sync protection');
}

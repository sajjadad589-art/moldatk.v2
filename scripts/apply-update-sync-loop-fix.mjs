import fs from 'node:fs';

const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = fs.readFileSync(syncPath, 'utf8');

// Realtime events + explicit local events are the primary sync path. A 2.5s poll caused
// continuous snapshot/push checks on Android and made the UI look like it was syncing forever.
sync = sync.replace(
  "    const timer = window.setInterval(onLocalChange, 2500);",
  "    // Safety reconciliation only; realtime + moldatk-local-sync handle normal changes immediately.\n    const timer = window.setInterval(onLocalChange, 60 * 1000);"
);

if (!sync.includes('window.setInterval(onLocalChange, 60 * 1000)')) {
  throw new Error('Update/sync loop fix: cloud sync interval was not hardened');
}
fs.writeFileSync(syncPath, sync, 'utf8');

const updatePath = 'src/components/AndroidUpdateChecker.tsx';
const update = fs.readFileSync(updatePath, 'utf8');
if (!update.includes('AUTO_UPDATE_COOLDOWN_MS') || !update.includes('wasAutoStartedRecently')) {
  throw new Error('Update/sync loop fix: persisted Android update retry guard missing');
}
if (!update.includes('checkInFlightRef')) {
  throw new Error('Update/sync loop fix: concurrent update check guard missing');
}

console.log('Update/sync loop fix passed: Android update is single-flight/persisted and cloud sync no longer polls every 2.5 seconds.');

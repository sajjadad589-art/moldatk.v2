import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error('Subscriber delete tombstone finalizer: ' + msg); };

// Permanent subscriber deletion needs a durable local tombstone. The server purge is
// authoritative, while the tombstone prevents a stale/in-flight/cloud pull from
// resurrecting the deleted subscriber and lets later realtime recovery re-delete any
// stale row recreated by another old client.
{
  const p = 'src/App.tsx';
  let s = read(p);

  const oldClear = `    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');
      const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];
      localStorage.setItem(tombstoneKey, JSON.stringify(deleted.filter(id => id !== subId)));
    } catch (e) {}`;

  const durable = `    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');
      const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];
      localStorage.setItem(tombstoneKey, JSON.stringify([...new Set([...deleted, subId])]));
    } catch (e) {}`;

  if (s.includes(oldClear)) s = s.replace(oldClear, durable);

  must(s.includes("JSON.stringify([...new Set([...deleted, subId])])"), 'delete handler does not persist durable subscriber tombstone');
  must(!s.includes("deleted.filter(id => id !== subId)"), 'delete handler still clears subscriber tombstone');
  write(p, s);
}

{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);

  // Never clear subscriber tombstones after one successful flight. Deleted line/tariff
  // tombstones remain one-shot because their cloud delete is already authoritative.
  const oldLoop = `    for (const name of ['deletedSubscribers', 'deletedLines', 'deletedTariffs']) {
      const remaining = read(storage, keys[name], []).filter((v: string) => !sent[name].includes(v));
      storage.setItem(keys[name], JSON.stringify(remaining));
      ack[name] = [];
    }`;
  const newLoop = `    for (const name of ['deletedLines', 'deletedTariffs']) {
      const remaining = read(storage, keys[name], []).filter((v: string) => !sent[name].includes(v));
      storage.setItem(keys[name], JSON.stringify(remaining));
      ack[name] = [];
    }
    // Subscriber deletion is permanent. Keep its tombstone in both snapshot and ack so
    // it does not create pending work, but can still suppress/re-delete stale cloud rows.
    ack.deletedSubscribers = read(storage, keys.deletedSubscribers, []);`;
  if (s.includes(oldLoop)) s = s.replace(oldLoop, newLoop);

  // Pull must preserve tombstones and exclude tombstoned cloud rows from React/local
  // state. If a stale client recreated one, the owner silently removes it again.
  const nextAnchor = `    const next: Snapshot = {
      ...empty,
      subscribers: subs.map(row => {`;
  if (s.includes(nextAnchor) && !s.includes('PERMANENT_SUBSCRIBER_TOMBSTONE_PULL_V1')) {
    const replacement = `    // PERMANENT_SUBSCRIBER_TOMBSTONE_PULL_V1
    const deletedSubscriberIds = new Set<string>(read(storage, keys.deletedSubscribers, []).map(String));
    const resurrectedIds = subs.filter(row => deletedSubscriberIds.has(String(row.id))).map(row => String(row.id));
    if (session.role === 'generator_admin' && resurrectedIds.length) {
      // Idempotent re-delete: protects against stale tabs/devices that still had the old subscriber.
      await remove('generator_subscribers', resurrectedIds);
    }
    const next: Snapshot = {
      ...empty,
      deletedSubscribers: [...deletedSubscriberIds],
      subscribers: subs.filter(row => !deletedSubscriberIds.has(String(row.id))).map(row => {`;
    s = s.replace(nextAnchor, replacement);
  }

  must(s.includes("for (const name of ['deletedLines', 'deletedTariffs'])"), 'subscriber tombstone is still cleared after push');
  must(s.includes('PERMANENT_SUBSCRIBER_TOMBSTONE_PULL_V1'), 'pull tombstone guard missing');
  must(s.includes('deletedSubscribers: [...deletedSubscriberIds]'), 'pull does not preserve subscriber tombstones');
  must(s.includes("subs.filter(row => !deletedSubscriberIds.has(String(row.id)))"), 'pull can still resurrect tombstoned subscriber');
  write(p, s);
}

console.log('Permanent subscriber deletion tombstone guard applied.');

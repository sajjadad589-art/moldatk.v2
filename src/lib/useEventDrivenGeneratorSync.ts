import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { createEventSyncScheduler, stableSnapshot, changedRows } from './eventSyncScheduler';
import { cacheCashbox } from './cashboxCloud';
import { subscriberToRow, invoiceToRow, lineToRow, tariffToRow, rowToSubscriber, rowToInvoice, rowToLine, rowToTariff, dedupeInvoicesForCloud } from './cloudSyncRows';
import type { ActiveUserSession, Subscriber, SubscriberInvoice, LineDistribution, MonthlyTariffRecord, AuditLogEntry } from '../types';

type Snapshot = {
  subscribers: Subscriber[]; lines: LineDistribution[]; tariffs: MonthlyTariffRecord[];
  audit: AuditLogEntry[]; specs: any; invoice: any; invoiceCustom: any;
  deletedSubscribers: string[]; deletedLines: string[]; deletedTariffs: string[];
};
const bases = {
  subscribers: 'moldatk_subscribers', lines: 'moldatk_lines', tariffs: 'moldatk_monthly_tariffs',
  audit: 'moldatk_audit_logs', specs: 'moldatk_generator', invoice: 'moldatk_invoice_template',
  invoiceCustom: 'moldatk_invoice_custom_settings', deletedSubscribers: 'moldatk_deleted_subscribers',
  deletedLines: 'moldatk_deleted_line_ids', deletedTariffs: 'moldatk_deleted_tariffs',
};
const empty: Snapshot = { subscribers: [], lines: [], tariffs: [], audit: [], specs: null,
  invoice: null, invoiceCustom: null, deletedSubscribers: [], deletedLines: [], deletedTariffs: [] };
const progress = (active: boolean, pending = false) => window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {
  detail: { active, pending, progress: active ? 20 : pending ? 0 : 100,
    message: active ? 'جاري المزامنة' : pending ? 'تعديلات محفوظة — أعد المحاولة عند توفر الاتصال' : 'اكتملت المزامنة' },
}));
const read = (storage: Storage, key: string, fallback: any) => {
  try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};

/** Exported service permits real scheduler/transport regression tests without a browser session. */
export function createGeneratorSync(session: ActiveUserSession, client = supabase, storage: Storage = localStorage) {
  const id = session.generatorId!;
  const key = (base: string) => `${base}_${id}`;
  const keys = Object.fromEntries(Object.entries(bases).map(([name, base]) => [name, key(base)]));
  const ackKey = key('moldatk_sync_ack_v2');
  const pendingKey = key('moldatk_pending_sync');
  const snapshot = (): Snapshot => Object.fromEntries(Object.keys(bases).map(name =>
    [name, read(storage, keys[name], empty[name])])) as Snapshot;
  let ack: Snapshot = read(storage, ackKey, storage.getItem(pendingKey) === '1' ? empty : snapshot());
  let observed = stableSnapshot(snapshot());
  let revision = 0;
  let disposed = false;
  let remoteDuringPull = false;
  let stage: 'idle' | 'push' | 'pull' = 'idle';
  const saveAck = () => storage.setItem(ackKey, JSON.stringify(ack));
  const pending = () => stableSnapshot(snapshot()) !== stableSnapshot(ack);
  const apply = (next: Snapshot) => {
    for (const name of Object.keys(bases)) storage.setItem(keys[name], JSON.stringify(next[name]));
    ack = next;
    observed = stableSnapshot(next);
    saveAck();
    storage.removeItem(pendingKey);
    // Consumers refresh React state; the synchronizer ignores this source explicitly.
    window.dispatchEvent(new CustomEvent('moldatk-local-sync', { detail: { source: 'cloud', generatorId: id } }));
  };
  async function upsert(table: string, rows: any[], conflict = 'generator_id,id', ignoreDuplicates = false) {
    for (let i = 0; i < rows.length; i += 200) {
      if (disposed) throw new Error('sync_disposed');
      const { error } = await client.from(table).upsert(rows.slice(i, i + 200), { onConflict: conflict, ignoreDuplicates });
      if (error) throw error;
    }
  }
  async function remove(table: string, ids: string[]) {
    if (!ids.length) return;
    const { error } = await client.from(table).delete().eq('generator_id', id).in('id', ids);
    if (error) throw error;
  }
  async function all(table: string, order = 'id') {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      if (disposed) throw new Error('sync_disposed');
      const { data, error } = await client.from(table).select('*').eq('generator_id', id).order(order).range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
  }
  async function push(sent: Snapshot) {
    stage = 'push';
    const owner = session.role === 'generator_admin';
    const writable = (s: Subscriber) => owner || !(s.tier === 'free' || s.isExempted || s.paymentStatus === 'free');
    const subscribers = changedRows(sent.subscribers, ack.subscribers).filter(writable);
    const priorInvoices = ack.subscribers.flatMap(s => s.invoicesHistory || []);
    const invoices = changedRows(dedupeInvoicesForCloud(sent.subscribers.filter(writable).flatMap(s => s.invoicesHistory || [])), priorInvoices);
    // Explicit tombstones only. Never infer a subscriber deletion from an incomplete pull.
    await remove('generator_subscribers', sent.deletedSubscribers);
    await upsert('generator_subscribers', subscribers.map(s => subscriberToRow(id, s)));
    await upsert('generator_invoices', invoices.map(i => invoiceToRow(id, i)));
    if (owner) {
      await remove('generator_lines', sent.deletedLines);
      const oldLines = ack.lines.map((line, index) => ({ ...line, sortOrder: index }));
      const lines = changedRows(sent.lines.map((line, index) => ({ ...line, sortOrder: index })), oldLines);
      await upsert('generator_lines', lines.map(l => lineToRow(id, l, l.sortOrder)));
      await remove('generator_monthly_tariffs', sent.deletedTariffs);
      const tariffs = changedRows(sent.tariffs, ack.tariffs);
      await upsert('generator_monthly_tariffs', tariffs.map(t => tariffToRow(id, t)));
      if (['specs', 'invoice', 'invoiceCustom'].some(k => stableSnapshot(sent[k]) !== stableSnapshot(ack[k]))) {
        await upsert('generator_settings', [{ generator_id: id, specs: sent.specs || {},
          invoice_settings: { template: sent.invoice || {}, custom: sent.invoiceCustom || {} } }], 'generator_id');
      }
      // Reconcile only a locally changed active tariff. Pull is strictly read-only.
      const active = sent.tariffs.find(t => t.isCurrentActive);
      if (active && tariffs.some(t => t.id === active.id)) {
        const { error } = await client.rpc('reconcile_generator_monthly_cycle', { p_generator_id: id, p_tariff_id: active.id });
        if (error) throw error;
      } else if (sent.tariffs.length === 0 && (sent.deletedTariffs.length > 0 || ack.tariffs.length > 0)) {
        const { error } = await client.rpc('reconcile_generator_no_tariff_state', { p_generator_id: id });
        if (error) throw error;
      }
    }
    await upsert('generator_audit_logs', changedRows(sent.audit, ack.audit).map(a => ({
      id: a.id, generator_id: id, timestamp: a.timestamp, category: a.category, title: a.title,
      details: a.details, entity_id: a.entityId || null, entity_name: a.entityName || null,
      actor_name: a.actorName, previous_value: a.previousValue || null, new_value: a.newValue || null,
      cancellation_reason: a.cancellationReason || null, amount: a.amount ?? null,
    })), 'generator_id,id', true);
    if (disposed) return;
    ack = sent;
    // Clear only tombstones sent by this flight; preserve edits made while awaiting I/O.
    for (const name of ['deletedSubscribers', 'deletedLines', 'deletedTariffs']) {
      const remaining = read(storage, keys[name], []).filter((v: string) => !sent[name].includes(v));
      storage.setItem(keys[name], JSON.stringify(remaining));
      ack[name] = [];
    }
    saveAck();
    if (!pending()) storage.removeItem(pendingKey);
  }
  async function pull() {
    stage = 'pull';
    remoteDuringPull = false;
    const started = revision;
    const before = stableSnapshot(snapshot());
    const [subs, invoices, lines, tariffs, logs, settings, cashbox] = await Promise.all([
      all('generator_subscribers'), all('generator_invoices'), all('generator_lines', 'sort_order'),
      all('generator_monthly_tariffs'), all('generator_audit_logs'),
      client.from('generator_settings').select('*').eq('generator_id', id).maybeSingle(),
      client.rpc('get_generator_cashbox', { p_generator_id: id }),
    ]);
    if (settings.error) throw settings.error;
    if (cashbox.error) throw cashbox.error;
    if (disposed || started !== revision || before !== stableSnapshot(snapshot())) return;
    const history = new Map<string, SubscriberInvoice[]>();
    for (const row of invoices) {
      const inv = rowToInvoice(row);
      history.set(inv.subscriberId, [...(history.get(inv.subscriberId) || []), inv]);
    }
    const inv = settings.data?.invoice_settings || {};
    const remoteTariffs = tariffs.map(rowToTariff).sort((a, b) => b.year - a.year || b.month - a.month);
    const noCurrentTariff = remoteTariffs.length === 0;
    const next: Snapshot = {
      ...empty,
      subscribers: subs.map(row => {
        const subscriber = { ...rowToSubscriber(row), invoicesHistory: history.get(row.id) || [] };
        return noCurrentTariff
          ? { ...subscriber, amountDue: 0, amountPaid: 0, paymentStatus: subscriber.tier === 'free' || subscriber.isExempted ? 'free' : 'unpaid' }
          : subscriber;
      }),
      lines: lines.map(rowToLine), tariffs: remoteTariffs,
      audit: logs.map(r => ({ id: r.id, timestamp: r.timestamp, category: r.category, title: r.title,
        details: r.details, entityId: r.entity_id || undefined, entityName: r.entity_name || undefined,
        actorName: r.actor_name, previousValue: r.previous_value || undefined, newValue: r.new_value || undefined,
        cancellationReason: r.cancellation_reason || undefined, amount: r.amount == null ? undefined : Number(r.amount) })),
      specs: settings.data?.specs || snapshot().specs,
      invoice: inv.template || (Object.keys(inv).length ? inv : snapshot().invoice),
      invoiceCustom: inv.custom || snapshot().invoiceCustom,
    };
    cacheCashbox(id, cashbox.data);
    apply(next);
    if (remoteDuringPull) scheduler.request(); // An external event arrived after reads began.
  }
  const scheduler = createEventSyncScheduler(async () => {
    if (disposed || storage.getItem(key('moldatk_factory_reset_in_progress')) === '1') return;
    if (!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw error || new Error('auth_required');
    if (disposed) return;
    progress(true);
    try {
      if (pending()) await push(snapshot());
      // A newer user edit is already queued by its event; never overwrite it with a pull.
      if (!disposed && !pending()) await pull();
      if (!disposed) progress(false, pending());
    } finally { stage = 'idle'; }
  }, { onError: error => { if (!disposed) { console.error('Generator sync failed:', error); progress(false, true); } } });
  function local(event?: Event) {
    if ((event as CustomEvent)?.detail?.source === 'cloud') return;
    const now = snapshot();
    const current = stableSnapshot(now);
    // A sibling tab may have applied and acknowledged this cloud snapshot.
    const diskAck = read(storage, ackKey, null);
    if (diskAck && current === stableSnapshot(diskAck)) {
      ack = diskAck;
      observed = current;
      return;
    }
    if (current === observed) return;
    // Cabinet removal is the one legacy editor that does not write a tombstone itself.
    const prior = JSON.parse(observed) as Snapshot;
    const removed = prior.lines.filter(l => !now.lines.some(n => n.id === l.id)).map(l => l.id);
    if (removed.length) storage.setItem(keys.deletedLines, JSON.stringify([...new Set([...now.deletedLines, ...removed])]));
    observed = stableSnapshot(snapshot());
    revision++;
    storage.setItem(pendingKey, '1');
    scheduler.request();
  }
  return {
    local,
    remote() { if (stage === 'pull') remoteDuringPull = true; else if (!scheduler.running) scheduler.request(); },
    request() { scheduler.request(); },
    async flush() { local(); scheduler.request(); await scheduler.flush(); if (pending()) throw new Error('unsynced_local_changes'); },
    dispose() { disposed = true; scheduler.dispose(); },
  };
}

const activeSync = new Map<string, ReturnType<typeof createGeneratorSync>>();
export async function flushGeneratorSync(id: string) {
  const sync = activeSync.get(id);
  if (!sync) throw new Error('sync_not_ready');
  await sync.flush();
}

export function useEventDrivenGeneratorSync(session: ActiveUserSession | null) {
  useEffect(() => {
    if (!session?.generatorId || !['generator_admin', 'collector'].includes(session.role)) return;
    const id = session.generatorId;
    const sync = createGeneratorSync(session);
    activeSync.set(id, sync);
    const channel = supabase.channel(`event-generator-sync-${id}`);
    for (const table of ['generator_subscribers', 'generator_invoices', 'generator_lines', 'generator_monthly_tariffs',
      'generator_settings', 'generator_audit_logs', 'generator_cashbox_resets']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `generator_id=eq.${id}` }, sync.remote);
    }
    channel.subscribe(status => { if (status === 'SUBSCRIBED') sync.request(); });
    const visibility = () => { if (document.visibilityState === 'visible') sync.request(); };
    const storage = (event: StorageEvent) => { if (event.key?.endsWith(`_${id}`)) sync.local(event); };
    const cashbox = () => sync.request();
    window.addEventListener('moldatk-local-sync', sync.local);
    window.addEventListener('moldatk-cashbox-changed', cashbox);
    window.addEventListener('moldatk-sync-now', sync.request);
    window.addEventListener('online', sync.request);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    sync.request();
    return () => {
      sync.dispose();
      if (activeSync.get(id) === sync) activeSync.delete(id);
      window.removeEventListener('moldatk-local-sync', sync.local);
      window.removeEventListener('moldatk-cashbox-changed', cashbox);
      window.removeEventListener('moldatk-sync-now', sync.request);
      window.removeEventListener('online', sync.request);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
      void supabase.removeChannel(channel);
    };
  }, [session?.generatorId, session?.role]);
}

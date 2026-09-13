/** One timer per external event burst; completion itself never requests another run. */
export function createEventSyncScheduler(run: () => Promise<void>, options: {
  debounceMs?: number; cooldownMs?: number; errorCooldownMs?: number;
  onError?: (error: unknown) => void;
} = {}) {
  const debounce = options.debounceMs ?? 350;
  const cooldown = options.cooldownMs ?? 1500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let requested = false;
  let disposed = false;
  let after = 0;
  function arm() {
    if (disposed || active || !requested) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void execute(); }, Math.max(debounce, after - Date.now()));
  }
  async function execute() {
    if (disposed) return;
    if (active) return active;
    requested = false;
    // Take the lock synchronously, before auth or any other awaited operation.
    active = Promise.resolve().then(run).then(() => {
      after = Date.now() + cooldown;
    }, error => {
      after = Date.now() + (options.errorCooldownMs ?? 15000);
      requested = false; // No automatic retry loop. A new local/online/manual event retries.
      options.onError?.(error);
      throw error;
    });
    try { await active; } catch { /* reported above; pending data stays durable */ }
    finally { active = undefined; arm(); }
  }
  return {
    request() { if (!disposed) { requested = true; arm(); } },
    async flush() {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (active) await active.catch(() => {});
      if (requested && !disposed) await execute();
    },
    // Postgres events received during a push are covered by its following pull.
    get running() { return !!active; },
    dispose() { disposed = true; requested = false; if (timer) clearTimeout(timer); },
  };
}

export function stableSnapshot(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableSnapshot).join(',') + ']';
  return '{' + Object.keys(value).sort().filter(k => (value as any)[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + stableSnapshot((value as any)[k])).join(',') + '}';
}

export function changedRows<T extends { id: string }>(rows: T[], previous: T[]): T[] {
  const old = new Map(previous.map(row => [row.id, stableSnapshot(row)]));
  return rows.filter(row => old.get(row.id) !== stableSnapshot(row));
}


import { supabase } from './supabase';

export interface CashboxState { reset_id: string | null; reset_at: string | null; balance: number | null }
export const cashboxKey = (id: string) => `moldatk_cashbox_server_${id}`;

export function cacheCashbox(id: string, state: CashboxState) {
  localStorage.setItem(cashboxKey(id), JSON.stringify(state));
  const key = `moldatk_wallet_reset_timestamp_${id}`;
  if (state.reset_at) localStorage.setItem(key, state.reset_at);
  else localStorage.removeItem(key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // RFC4122-compatible fallback for older Android WebViews/PWA engines.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function callReset(id: string, requestId: string) {
  const result = await supabase.rpc('reset_generator_cashbox', {
    p_generator_id: id,
    p_request_id: requestId,
  });
  return result;
}

const resetFlights = new Map<string, Promise<CashboxState>>();
export function resetCashbox(id: string): Promise<CashboxState> {
  const existing = resetFlights.get(id);
  if (existing) return existing;

  // Reuse a valid request after an ambiguous network failure so a retry remains idempotent.
  // Discard malformed stale values left by older browsers/builds.
  const requestKey = `moldatk_cashbox_reset_request_${id}`;
  const stored = localStorage.getItem(requestKey) || '';
  const requestId = UUID_RE.test(stored) ? stored : makeRequestId();
  localStorage.setItem(requestKey, requestId);

  const flight = (async () => {
    let { data, error } = await callReset(id, requestId);

    // A stale/expired Supabase auth token can look exactly like a connectivity failure.
    // Refresh once, then retry the same idempotent request id.
    if (error) {
      const msg = `${(error as any)?.message || ''} ${(error as any)?.code || ''}`;
      const authLike = /jwt|auth|token|not_authorized|42501|401|403/i.test(msg);
      if (authLike) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session) {
          const retry = await callReset(id, requestId);
          data = retry.data;
          error = retry.error;
        }
      }
    }

    if (error) throw error;
    if (!data?.reset_at || !data?.reset_id) throw new Error('cashbox_reset_not_confirmed');

    cacheCashbox(id, data as CashboxState);
    localStorage.removeItem(requestKey);
    window.dispatchEvent(new CustomEvent('moldatk-cashbox-changed', { detail: { generatorId: id } }));
    return data as CashboxState;
  })().finally(() => resetFlights.delete(id));

  resetFlights.set(id, flight);
  return flight;
}

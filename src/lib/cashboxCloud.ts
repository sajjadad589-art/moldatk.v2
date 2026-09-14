import { supabase } from './supabase';

export interface CashboxState { reset_id: string | null; reset_at: string | null; balance: number | null }
export const cashboxKey = (id: string) => `moldatk_cashbox_server_${id}`;

export function cacheCashbox(id: string, state: CashboxState) {
  localStorage.setItem(cashboxKey(id), JSON.stringify(state));
  const key = `moldatk_wallet_reset_timestamp_${id}`;
  if (state.reset_at) localStorage.setItem(key, state.reset_at);
  else localStorage.removeItem(key);
}

const resetFlights = new Map<string, Promise<CashboxState>>();
export function resetCashbox(id: string): Promise<CashboxState> {
  const existing = resetFlights.get(id);
  if (existing) return existing;
  // Reuse after ambiguous network failures: a retry must not discard later collections.
  const requestKey = `moldatk_cashbox_reset_request_${id}`;
  const requestId = localStorage.getItem(requestKey) || crypto.randomUUID();
  localStorage.setItem(requestKey, requestId);
  const flight = (async () => {
    const { data, error } = await supabase.rpc('reset_generator_cashbox', {
      p_generator_id: id, p_request_id: requestId,
    });
    if (error) throw error;
    if (!data?.reset_at || !data?.reset_id) throw new Error('cashbox_reset_not_confirmed');
    cacheCashbox(id, data);
    localStorage.removeItem(requestKey);
    window.dispatchEvent(new CustomEvent('moldatk-cashbox-changed', { detail: { generatorId: id } }));
    return data as CashboxState;
  })().finally(() => resetFlights.delete(id));
  resetFlights.set(id, flight);
  return flight;
}


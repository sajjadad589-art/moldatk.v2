import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

type CashboxResponse = { reset_at?: string | null; balance?: number | string | null } | null;

/** Read the server-authoritative balance. Local data is only the first-paint fallback. */
export function useCashboxBalance(fallback: number) {
  const [serverBalance, setServerBalance] = useState<number | null>(() => {
    try {
      const session = JSON.parse(localStorage.getItem('moldatk_session') || 'null');
      const state = JSON.parse(localStorage.getItem(`moldatk_cashbox_server_${session?.generatorId}`) || 'null');
      const value = Number(state?.balance);
      return state?.reset_at && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  });

  const refresh = useCallback(async () => {
    try {
      const session = JSON.parse(localStorage.getItem('moldatk_session') || 'null');
      const generatorId = session?.generatorId;
      if (!generatorId) return;
      const { data, error } = await supabase.rpc('get_generator_cashbox', {
        p_generator_id: generatorId,
      });
      if (error) throw error;
      const value = Number((data as CashboxResponse)?.balance);
      if ((data as CashboxResponse)?.balance != null && Number.isFinite(value)) {
        setServerBalance(value);
        localStorage.setItem(`moldatk_cashbox_server_${generatorId}`, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Cashbox server refresh failed:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => { void refresh(); };
    window.addEventListener('moldatk-local-sync', onChanged);
    window.addEventListener('moldatk-cashbox-changed', onChanged);
    window.addEventListener('storage', onChanged);
    window.addEventListener('moldatk-sync-now', onChanged);
    return () => {
      window.removeEventListener('moldatk-local-sync', onChanged);
      window.removeEventListener('moldatk-cashbox-changed', onChanged);
      window.removeEventListener('storage', onChanged);
      window.removeEventListener('moldatk-sync-now', onChanged);
    };
  }, [refresh]);

  return serverBalance ?? fallback;
}

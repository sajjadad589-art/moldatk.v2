import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

type CashboxResponse = { reset_at?: string | null; balance?: number | string | null } | null;

const sessionContext = () => {
  try {
    const session = JSON.parse(localStorage.getItem('moldatk_session') || 'null');
    const generatorId = String(session?.generatorId || '');
    return {
      generatorId,
      cacheKey: generatorId ? `moldatk_cashbox_server_${generatorId}` : '',
      pendingKey: generatorId ? `moldatk_pending_sync_${generatorId}` : '',
    };
  } catch {
    return { generatorId: '', cacheKey: '', pendingKey: '' };
  }
};

const readCachedBalance = (): number | null => {
  const { cacheKey } = sessionContext();
  if (!cacheKey) return null;
  try {
    const state = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    const value = Number(state?.balance);
    return state?.balance != null && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

/**
 * Shared cashbox balance for dashboard + cashbox screen.
 * Local fallback is used only while this device has an unsynced local write, so a
 * just-completed payment appears immediately instead of briefly reverting to stale 0.
 */
export function useCashboxBalance(fallback: number) {
  const [serverBalance, setServerBalance] = useState<number | null>(() => readCachedBalance());
  const [preferLocalPending, setPreferLocalPending] = useState<boolean>(() => {
    const { pendingKey } = sessionContext();
    try { return Boolean(pendingKey && localStorage.getItem(pendingKey) === '1'); } catch { return false; }
  });

  const refresh = useCallback(async () => {
    const { generatorId, cacheKey } = sessionContext();
    if (!generatorId) return;
    try {
      const { data, error } = await supabase.rpc('get_generator_cashbox', { p_generator_id: generatorId });
      if (error) throw error;
      const value = Number((data as CashboxResponse)?.balance);
      if ((data as CashboxResponse)?.balance != null && Number.isFinite(value)) {
        setServerBalance(value);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Cashbox server refresh failed:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onLocalSync = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.source === 'cloud') {
        const cached = readCachedBalance();
        if (cached != null) setServerBalance(cached);
        setPreferLocalPending(false);
      } else {
        setPreferLocalPending(true);
      }
      void refresh();
    };

    const onCashboxChanged = () => {
      const cached = readCachedBalance();
      if (cached != null) setServerBalance(cached);
      setPreferLocalPending(false);
      void refresh();
    };

    const onStorage = (event: StorageEvent) => {
      const { cacheKey, pendingKey } = sessionContext();
      if (cacheKey && event.key === cacheKey) {
        const cached = readCachedBalance();
        if (cached != null) setServerBalance(cached);
      }
      if (pendingKey && event.key === pendingKey) setPreferLocalPending(event.newValue === '1');
    };

    window.addEventListener('moldatk-local-sync', onLocalSync);
    window.addEventListener('moldatk-cashbox-changed', onCashboxChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('moldatk-sync-now', onCashboxChanged);
    window.addEventListener('online', onCashboxChanged);
    return () => {
      window.removeEventListener('moldatk-local-sync', onLocalSync);
      window.removeEventListener('moldatk-cashbox-changed', onCashboxChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('moldatk-sync-now', onCashboxChanged);
      window.removeEventListener('online', onCashboxChanged);
    };
  }, [refresh]);

  return preferLocalPending ? fallback : (serverBalance ?? fallback);
}

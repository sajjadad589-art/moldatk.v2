import { useEffect, useReducer } from 'react';

/** All three cashbox surfaces use the same acknowledged server snapshot. */
export function useCashboxBalance(fallback: number) {
  const [, refresh] = useReducer(n => n + 1, 0);
  useEffect(() => {
    window.addEventListener('moldatk-local-sync', refresh);
    window.addEventListener('moldatk-cashbox-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('moldatk-local-sync', refresh);
      window.removeEventListener('moldatk-cashbox-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  try {
    const session = JSON.parse(localStorage.getItem('moldatk_session') || 'null');
    const state = JSON.parse(localStorage.getItem(`moldatk_cashbox_server_${session?.generatorId}`) || 'null');
    if (state?.reset_at && Number.isFinite(Number(state.balance))) return Number(state.balance);
  } catch { /* No server snapshot yet: use reset-aware cached history. */ }
  return fallback;
}


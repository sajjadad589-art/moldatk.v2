(() => {
  const VERSION = 'moldatk-pwa-recovery-v5-1.3.18';
  const STORAGE_KEY = 'moldatk_pwa_recovery_version';
  const RELOAD_KEY = 'moldatk_pwa_recovery_reloaded_v5';

  try {
    if (localStorage.getItem(STORAGE_KEY) === VERSION) return;
    localStorage.setItem(STORAGE_KEY, VERSION);
  } catch (_) {}

  const recover = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)));
      }
    } catch (_) {}

    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key).catch(() => false)));
      }
    } catch (_) {}

    try {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        const url = new URL(window.location.href);
        url.searchParams.set('_moldatk_refresh', Date.now().toString());
        window.location.replace(url.toString());
      }
    } catch (_) {
      window.location.reload();
    }
  };

  void recover();
})();

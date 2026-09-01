import fs from 'node:fs';

// Fix stale/expired Supabase sessions causing repeated 401 sync loops and noisy 406 single-row reads.

const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = fs.readFileSync(syncPath, 'utf8');
let syncChanged = false;

if (!sync.includes('const authBlocked = useRef(false);')) {
  sync = sync.replace(
    "  const lastSnapshot = useRef('');",
    "  const lastSnapshot = useRef('');\n  const authBlocked = useRef(false);"
  );
  syncChanged = true;
}

if (!sync.includes('const signalExpiredAuth = () =>')) {
  const marker = "    const snapshot = () => JSON.stringify({";
  const helper = `    const signalExpiredAuth = () => {\n      if (authBlocked.current || disposed) return;\n      authBlocked.current = true;\n      ready.current = false;\n      try {\n        window.dispatchEvent(new CustomEvent('moldatk-auth-expired'));\n        window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {\n          detail: { active: false, progress: 0, pending: false, message: 'انتهت جلسة الدخول — يرجى تسجيل الدخول مرة أخرى' }\n        }));\n      } catch {}\n    };\n\n    const ensureValidAuth = async () => {\n      if (authBlocked.current || disposed) return false;\n      try {\n        const { data, error } = await supabase.auth.getSession();\n        if (error || !data.session?.access_token) {\n          signalExpiredAuth();\n          return false;\n        }\n\n        const expiresAtMs = Number(data.session.expires_at || 0) * 1000;\n        if (expiresAtMs && expiresAtMs <= Date.now() + 30000) {\n          const refreshed = await supabase.auth.refreshSession();\n          if (refreshed.error || !refreshed.data.session?.access_token) {\n            signalExpiredAuth();\n            return false;\n          }\n        }\n        return true;\n      } catch {\n        signalExpiredAuth();\n        return false;\n      }\n    };\n\n    const isUnauthorized = (error) => {\n      const status = Number(error?.status || error?.statusCode || 0);\n      const code = String(error?.code || '');\n      const message = String(error?.message || '').toLowerCase();\n      return status === 401 || code === 'PGRST301' || message.includes('jwt') || message.includes('unauthorized');\n    };\n\n`;
  if (sync.includes(marker)) {
    sync = sync.replace(marker, helper + marker);
    syncChanged = true;
  }
}

// Guard push before it can generate repeated 401 requests.
if (!sync.includes('if (!(await ensureValidAuth())) return;')) {
  sync = sync.replace(
    "    const push = async () => {\n      if (!ready.current || pushing.current || disposed) return;",
    "    const push = async () => {\n      if (!ready.current || pushing.current || disposed || authBlocked.current) return;\n      if (!(await ensureValidAuth())) return;"
  );
  syncChanged = true;
}

// Guard pull too, including realtime/visibility refreshes.
if (!sync.includes("const pull = async (bootstrap = false) => {\n      if (refreshing.current || authBlocked.current) return;")) {
  sync = sync.replace(
    "    const pull = async (bootstrap = false) => {\n      if (refreshing.current) return;",
    "    const pull = async (bootstrap = false) => {\n      if (refreshing.current || authBlocked.current) return;\n      if (!(await ensureValidAuth())) return;"
  );
  syncChanged = true;
}

// On unauthorized server responses, stop retrying and return to a clean login instead of logging forever.
sync = sync.replace(
  "      } catch (e) {\n        console.error('Moldatk cloud sync push failed:', e);",
  "      } catch (e) {\n        if (isUnauthorized(e)) { signalExpiredAuth(); return; }\n        console.error('Moldatk cloud sync push failed:', e);"
);

// Some later patches use the resilient catch text. Handle that variant too.
sync = sync.replace(
  "      } catch (e) {\n        console.error('Moldatk cloud sync push failed:', e);\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'تعذر الاتصال — ستتم المزامنة تلقائياً' });",
  "      } catch (e) {\n        if (isUnauthorized(e)) { signalExpiredAuth(); return; }\n        console.error('Moldatk cloud sync push failed:', e);\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'تعذر الاتصال — ستتم المزامنة تلقائياً' });"
);

// Ensure auth block is reset when a fresh authenticated app session mounts.
if (!sync.includes('authBlocked.current = false;\n    ready.current = false;')) {
  sync = sync.replace(
    "    let disposed = false;\n    ready.current = false;",
    "    let disposed = false;\n    authBlocked.current = false;\n    ready.current = false;"
  );
  syncChanged = true;
}

if (syncChanged) {
  fs.writeFileSync(syncPath, sync);
  console.log('Applied Supabase auth guard and unauthorized sync-loop recovery');
} else {
  fs.writeFileSync(syncPath, sync);
  console.log('Supabase auth guard already applied');
}

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
let appChanged = false;

// No 406 when RLS/auth makes the generator row temporarily unavailable.
if (app.includes(".eq('id', userSession.generatorId).single(),")) {
  app = app.replace(
    ".eq('id', userSession.generatorId).single(),",
    ".eq('id', userSession.generatorId).maybeSingle(),"
  );
  appChanged = true;
}

// A stale local Moldatk session must not keep the UI alive after Supabase auth expires.
if (!app.includes("window.addEventListener('moldatk-auth-expired', handleAuthExpired)")) {
  const marker = "  useEffect(() => {\n    let cancelled = false;\n    const loadSubscription = async () => {";
  const effect = `  useEffect(() => {\n    const handleAuthExpired = () => {\n      setUserSession(null);\n      setSubscriptionInfo(null);\n      try { localStorage.removeItem('moldatk_session'); } catch {}\n      void supabase.auth.signOut({ scope: 'local' }).catch(() => {});\n      showToast('انتهت جلسة الدخول، سجل الدخول مرة أخرى');\n    };\n\n    window.addEventListener('moldatk-auth-expired', handleAuthExpired);\n    return () => window.removeEventListener('moldatk-auth-expired', handleAuthExpired);\n  }, []);\n\n`;
  if (app.includes(marker)) {
    app = app.replace(marker, effect + marker);
    appChanged = true;
  }
}

if (appChanged) {
  fs.writeFileSync(appPath, app);
  console.log('Applied clean local logout on expired Supabase auth and safe generator lookup');
} else {
  console.log('App auth recovery already applied');
}

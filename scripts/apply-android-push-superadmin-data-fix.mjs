import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// 1) Register push notifications for every authenticated Android app role,
// not only the generator owner. This lets collectors/admin users receive system updates too.
const appPath = 'src/App.tsx';
let app = read(appPath);
const legacyPushGuard = "if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform()) return;";
const allRolesPushGuard = "if (!['generator_admin', 'collector', 'super_admin', 'super_admin_manager'].includes(String(userSession?.role || '')) || !Capacitor.isNativePlatform()) return;";
if (app.includes(legacyPushGuard)) {
  app = app.replace(legacyPushGuard, allRolesPushGuard);
}
if (!app.includes(allRolesPushGuard)) {
  throw new Error('Android push role guard was not applied');
}
write(appPath, app);

// 2) On Android cold start, React localStorage can restore the Super Admin UI a moment
// before Supabase restores its persisted JWT. The old dashboard queried immediately,
// so RLS returned empty data and the page looked blank. Wait for a real auth session,
// retry it, and reload automatically when Supabase restores/refreshes the session.
const superPath = 'src/components/SuperAdminDashboard.tsx';
let superAdmin = read(superPath);

if (!superAdmin.includes('SUPER_ADMIN_AUTH_READY_V1')) {
  const loadStart = `  const load = async () => {\n    setLoading(true);\n    setError(null);`;
  const guardedLoadStart = `  const load = async () => {\n    setLoading(true);\n    setError(null);\n\n    // SUPER_ADMIN_AUTH_READY_V1: Android WebView may restore the React session before Supabase JWT hydration.\n    let authSession = (await supabase.auth.getSession()).data.session;\n    if (!authSession) {\n      await new Promise(resolve => window.setTimeout(resolve, 250));\n      authSession = (await supabase.auth.getSession()).data.session;\n    }\n    if (!authSession) {\n      try {\n        const refreshed = await supabase.auth.refreshSession();\n        authSession = refreshed.data.session;\n      } catch {}\n    }\n    if (!authSession) {\n      setError('جلسة السوبر أدمن غير جاهزة. سجّل الدخول من جديد إذا استمرت المشكلة.');\n      setLoading(false);\n      return;\n    }`;

  if (!superAdmin.includes(loadStart)) throw new Error('Super Admin load() start not found');
  superAdmin = superAdmin.replace(loadStart, guardedLoadStart);
}

const legacyEffect = `  useEffect(() => { void load(); }, []);`;
if (superAdmin.includes(legacyEffect)) {
  const resilientEffect = `  useEffect(() => {\n    let active = true;\n    const runLoad = () => { if (active) void load(); };\n    const firstTimer = window.setTimeout(runLoad, 120);\n\n    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {\n      if (active && session) window.setTimeout(runLoad, 0);\n    });\n\n    const onVisible = () => {\n      if (document.visibilityState === 'visible') runLoad();\n    };\n    document.addEventListener('visibilitychange', onVisible);\n\n    return () => {\n      active = false;\n      window.clearTimeout(firstTimer);\n      authListener.subscription.unsubscribe();\n      document.removeEventListener('visibilitychange', onVisible);\n    };\n  }, []);`;
  superAdmin = superAdmin.replace(legacyEffect, resilientEffect);
}

if (!superAdmin.includes('SUPER_ADMIN_AUTH_READY_V1') || !superAdmin.includes('supabase.auth.onAuthStateChange')) {
  throw new Error('Super Admin auth/session recovery was not applied');
}

// Prevent the native phone viewport from being forced to a 1100px canvas.
superAdmin = superAdmin.replace("min-w-[1100px]", "min-w-0 overflow-x-auto");
write(superPath, superAdmin);

console.log('Android Firebase push roles and Super Admin Android data/session recovery applied.');

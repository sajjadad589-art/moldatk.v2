import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

// 1) Register push notifications for every authenticated Android app role,
// not only the generator owner. Locate the push useEffect structurally because
// earlier build transforms can rewrite the exact guard text.
const appPath = 'src/App.tsx';
let app = read(appPath);
const allRolesPushGuard = "if (!['generator_admin', 'collector', 'super_admin', 'super_admin_manager'].includes(String(userSession?.role || '')) || !Capacitor.isNativePlatform()) return;";

if (!app.includes(allRolesPushGuard)) {
  const setupIndex = app.indexOf('const setupPushNotifications = async () => {');
  if (setupIndex < 0) throw new Error('Push notification setup block not found');
  const effectStart = app.lastIndexOf('useEffect(() => {', setupIndex);
  if (effectStart < 0) throw new Error('Push notification useEffect not found');

  const beforeSetup = app.slice(effectStart, setupIndex);
  const guardRegex = /if\s*\([^\n;]*Capacitor\.isNativePlatform\(\)[^\n;]*\)\s*return;/;
  if (!guardRegex.test(beforeSetup)) {
    throw new Error('Android push native guard not found near setup block');
  }
  const patchedBeforeSetup = beforeSetup.replace(guardRegex, allRolesPushGuard);
  app = app.slice(0, effectStart) + patchedBeforeSetup + app.slice(setupIndex);
}

if (!app.includes(allRolesPushGuard)) throw new Error('Android push role guard was not applied');
write(appPath, app);

// 2) On Android cold start, React/localStorage can restore the Super Admin shell
// before Supabase has rehydrated its persisted JWT. RLS queries made during that gap
// can look empty. Make load() wait for auth and add an independent retry listener.
const superPath = 'src/components/SuperAdminDashboard.tsx';
let superAdmin = read(superPath);

if (!superAdmin.includes('SUPER_ADMIN_AUTH_READY_V1')) {
  const loadStartRegex = /  const load = async \(\) => \{\n\s*setLoading\(true\);\n\s*setError\(null\);/;
  const guardedLoadStart = `  const load = async () => {\n    setLoading(true);\n    setError(null);\n\n    // SUPER_ADMIN_AUTH_READY_V1: Android WebView may restore UI before Supabase JWT hydration.\n    let authSession = (await supabase.auth.getSession()).data.session;\n    if (!authSession) {\n      await new Promise(resolve => window.setTimeout(resolve, 250));\n      authSession = (await supabase.auth.getSession()).data.session;\n    }\n    if (!authSession) {\n      try {\n        const refreshed = await supabase.auth.refreshSession();\n        authSession = refreshed.data.session;\n      } catch {}\n    }\n    if (!authSession) {\n      setError('جلسة السوبر أدمن غير جاهزة. سجّل الدخول من جديد إذا استمرت المشكلة.');\n      setLoading(false);\n      return;\n    }`;

  if (!loadStartRegex.test(superAdmin)) throw new Error('Super Admin load() start not found');
  superAdmin = superAdmin.replace(loadStartRegex, guardedLoadStart);
}

if (!superAdmin.includes('SUPER_ADMIN_AUTH_LISTENER_V1')) {
  const statsMarker = '  const stats = useMemo(() => {';
  if (!superAdmin.includes(statsMarker)) throw new Error('Super Admin stats marker not found for auth listener injection');

  const resilientEffect = `  // SUPER_ADMIN_AUTH_LISTENER_V1\n  useEffect(() => {\n    let active = true;\n    const runLoad = () => { if (active) void load(); };\n    const firstTimer = window.setTimeout(runLoad, 180);\n\n    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {\n      if (active && session) window.setTimeout(runLoad, 0);\n    });\n\n    const onVisible = () => {\n      if (document.visibilityState === 'visible') runLoad();\n    };\n    document.addEventListener('visibilitychange', onVisible);\n\n    return () => {\n      active = false;\n      window.clearTimeout(firstTimer);\n      authListener.subscription.unsubscribe();\n      document.removeEventListener('visibilitychange', onVisible);\n    };\n  }, []);\n\n`;

  superAdmin = superAdmin.replace(statsMarker, resilientEffect + statsMarker);
}

if (!superAdmin.includes('SUPER_ADMIN_AUTH_READY_V1') || !superAdmin.includes('SUPER_ADMIN_AUTH_LISTENER_V1') || !superAdmin.includes('supabase.auth.onAuthStateChange')) {
  throw new Error('Super Admin auth/session recovery was not applied');
}

// Prevent the native phone viewport from being forced to a desktop-only canvas.
superAdmin = superAdmin.replace(/min-w-\[1100px\]/g, 'min-w-0 overflow-x-auto');
write(superPath, superAdmin);

console.log('Android Firebase push roles and Super Admin Android data/session recovery applied.');

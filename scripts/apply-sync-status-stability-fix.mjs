import fs from 'node:fs';

const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = fs.readFileSync(syncPath, 'utf8');

// Android WebView navigator.onLine is not reliable enough to gate cloud sync.
if (!sync.includes("import { Capacitor } from '@capacitor/core';")) {
  sync = sync.replace(
    "import { supabase } from './supabase';",
    "import { supabase } from './supabase';\nimport { Capacitor } from '@capacitor/core';"
  );
}

if (!sync.includes('const retryAfter = useRef(0);')) {
  sync = sync.replace(
    "  const lastSnapshot = useRef('');",
    "  const lastSnapshot = useRef('');\n  const retryAfter = useRef(0);"
  );
}

sync = sync.replaceAll(
  "typeof navigator !== 'undefined' && !navigator.onLine",
  "!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !navigator.onLine"
);

// A failed cloud request must not make Android alternate forever between syncing/pending every 2.5s.
sync = sync.replace(
  "        lastSnapshot.current = snapshot();\n        emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });",
  "        lastSnapshot.current = snapshot();\n        retryAfter.current = 0;\n        emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });"
);

sync = sync.replace(
  "        console.error('Moldatk cloud sync push failed:', e);\n        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'تعذر الاتصال — ستتم المزامنة تلقائياً' });",
  "        console.error('Moldatk cloud sync push failed:', e);\n        retryAfter.current = Date.now() + 15000;\n        emitSyncProgress({ active: false, progress: 0, pending: !Capacitor.isNativePlatform(), message: 'تعذر مزامنة السحابة — ستتم إعادة المحاولة تلقائياً' });"
);

sync = sync.replace(
  "    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;",
  "    const onLocalChange = () => {\n      if (!ready.current || refreshing.current) return;\n      if (Date.now() < retryAfter.current) return;"
);

sync = sync.replace(
  "    const handleOffline = () => {\n      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بدون إنترنت — سيتم حفظ العمليات للمزامنة' });\n    };",
  "    const handleOffline = () => {\n      if (Capacitor.isNativePlatform()) return;\n      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بدون إنترنت — سيتم حفظ العمليات للمزامنة' });\n    };"
);

fs.writeFileSync(syncPath, sync);

const indicatorPath = 'src/components/SyncProgressIndicator.tsx';
let indicator = fs.readFileSync(indicatorPath, 'utf8');

// On native Android, pending is a cloud-retry state, not proof that the device has no internet.
indicator = indicator.replace(
  "      const pending = Boolean(detail.pending) || !online;",
  "      const pending = Capacitor.isNativePlatform() ? false : (Boolean(detail.pending) || !online);"
);

// Never leave a transient sync state stuck forever if an event is missed.
if (!indicator.includes('const staleTimer = window.setTimeout')) {
  indicator = indicator.replace(
    "      setState({ online, syncing, progress, pending });",
    "      setState({ online, syncing, progress, pending });\n\n      const staleTimer = window.setTimeout(() => {\n        setState(current => current.syncing || current.pending\n          ? { online: Capacitor.isNativePlatform() ? true : current.online, syncing: false, progress: 0, pending: false }\n          : current);\n      }, 8000);\n      settleTimer = staleTimer;"
  );
}

fs.writeFileSync(indicatorPath, indicator);
console.log('Applied stable Android sync status with retry cooldown and anti-stuck indicator');

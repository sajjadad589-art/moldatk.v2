import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(`iOS performance patch: ${message}`); };

// 1) Reduce sync pressure: coalesce realtime bursts, stop 2.5s full snapshots, and fetch a bounded audit window.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  let src = read(path);
  must(src, 'cloud sync source missing');

  src = src.replace(/\.limit\(1000\)/g, '.limit(250)');

  if (!src.includes('MOLDATK_IOS_SYNC_COALESCE_V1')) {
    const bootstrapNeedle = "    void pull(true).catch";
    must(src.includes(bootstrapNeedle), 'cloud sync bootstrap marker missing');
    const scheduler = `    // MOLDATK_IOS_SYNC_COALESCE_V1\n    let realtimePullTimer: number | null = null;\n    const schedulePull = () => {\n      if (disposed || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;\n      if (realtimePullTimer !== null) window.clearTimeout(realtimePullTimer);\n      realtimePullTimer = window.setTimeout(() => {\n        realtimePullTimer = null;\n        void pull();\n      }, 320);\n    };\n\n`;
    src = src.replace(bootstrapNeedle, scheduler + bootstrapNeedle);
  }

  src = src.replace(/\(\) => void pull\(\)/g, 'schedulePull');
  src = src.replace(/window\.setInterval\(onLocalChange,\s*2500\)/g, "window.setInterval(() => { if (document.visibilityState === 'visible') onLocalChange(); }, 15000)");
  src = src.replace(/const visibility = \(\) => \{ if \(document\.visibilityState === 'visible'\) void pull\(\); \};/g, "const visibility = () => { if (document.visibilityState === 'visible') schedulePull(); };");

  if (!src.includes('if (realtimePullTimer !== null) window.clearTimeout(realtimePullTimer);')) {
    const cleanupNeedle = "      window.clearInterval(timer);";
    must(src.includes(cleanupNeedle), 'sync cleanup marker missing');
    src = src.replace(cleanupNeedle, cleanupNeedle + "\n      if (realtimePullTimer !== null) window.clearTimeout(realtimePullTimer);");
  }

  must(src.includes('MOLDATK_IOS_SYNC_COALESCE_V1'), 'sync coalescing marker missing');
  must(src.includes('15000'), 'slow fallback interval missing');
  must(!src.includes('setInterval(onLocalChange, 2500)'), 'old 2.5 second sync loop remains');
  write(path, src);
}

// 2) App: coalesce local-sync rerenders and split Super Admin/XLSX out of the owner iPhone bundle.
{
  const path = 'src/App.tsx';
  let src = read(path);
  must(src, 'App source missing');

  src = src.replace("import { SuperAdminDashboard } from './components/SuperAdminDashboard';\n", '');
  if (!src.includes('LazySuperAdminDashboard')) {
    const importNeedle = "import { FolderDetailModal } from './components/FolderDetailModal';";
    must(src.includes(importNeedle), 'App import marker missing');
    src = src.replace(importNeedle, `${importNeedle}\n\nconst LazySuperAdminDashboard = React.lazy(() =>\n  import('./components/SuperAdminDashboard').then(module => ({ default: module.SuperAdminDashboard }))\n);`);
  }

  src = src.replace(
    /return <SuperAdminDashboard onLogout=\{handleLogout\} \/>;/g,
    `return (\n      <React.Suspense fallback={<div className="min-h-screen bg-[#F7F9FC] dark:bg-[#081521]" />}>\n        <LazySuperAdminDashboard onLogout={handleLogout} />\n      </React.Suspense>\n    );`
  );

  if (!src.includes('MOLDATK_COALESCED_LOCAL_SYNC_V1')) {
    const simpleListener = "    const handleLocalSync = () => refreshScopedData();";
    must(src.includes(simpleListener), 'local sync listener marker missing');
    src = src.replace(simpleListener, `    // MOLDATK_COALESCED_LOCAL_SYNC_V1\n    let localSyncFrame = 0;\n    const handleLocalSync = () => {\n      if (localSyncFrame) return;\n      localSyncFrame = window.requestAnimationFrame(() => {\n        localSyncFrame = 0;\n        refreshScopedData();\n      });\n    };`);

    const cleanupNeedle = "      window.removeEventListener('moldatk-local-sync', handleLocalSync);";
    must(src.includes(cleanupNeedle), 'App local sync cleanup marker missing');
    src = src.replace(cleanupNeedle, cleanupNeedle + "\n      if (localSyncFrame) window.cancelAnimationFrame(localSyncFrame);");
  }

  must(src.includes('LazySuperAdminDashboard'), 'lazy Super Admin missing');
  must(src.includes('MOLDATK_COALESCED_LOCAL_SYNC_V1'), 'coalesced App rerender missing');
  write(path, src);
}

// 3) Mobile subscriber list: cap live DOM size and defer search typing work.
{
  const path = 'src/components/mobile/MobileSubscribers.tsx';
  let src = read(path);
  must(src, 'MobileSubscribers source missing');

  src = src.replace(/import React, \{([^}]*)\} from 'react';/, (match, names) => {
    const items = String(names).split(',').map(x => x.trim()).filter(Boolean);
    for (const item of ['useDeferredValue', 'useEffect']) if (!items.includes(item)) items.push(item);
    return `import React, { ${items.join(', ')} } from 'react';`;
  });

  if (!src.includes('MOLDATK_MOBILE_PROGRESSIVE_LIST_V1')) {
    const stateNeedle = "  const [lineFilter, setLineFilter] = useState<string>('all');";
    must(src.includes(stateNeedle), 'mobile filter state marker missing');
    src = src.replace(stateNeedle, `${stateNeedle}\n  // MOLDATK_MOBILE_PROGRESSIVE_LIST_V1\n  const [visibleLimit, setVisibleLimit] = useState(60);\n  const deferredSearchTerm = useDeferredValue(searchTerm);`);

    src = src.replace(/const needle = searchTerm\.trim\(\)\.toLowerCase\(\);/g, 'const needle = deferredSearchTerm.trim().toLowerCase();');

    const componentReturnNeedle = "\n  return (\n    <div";
    must(src.includes(componentReturnNeedle), 'mobile component return marker missing');
    src = src.replace(componentReturnNeedle, `\n  useEffect(() => {\n    setVisibleLimit(60);\n  }, [deferredSearchTerm, statusFilter, lineFilter]);\n\n  const visibleSubscribers = filteredSubscribers.slice(0, visibleLimit);\n${componentReturnNeedle}`);

    src = src.replace(/filteredSubscribers\.map\(sub => \{/g, 'visibleSubscribers.map(sub => {');

    const addButtonNeedle = "      <button\n        onClick={() => onOpenSubscriberModal(null)}";
    must(src.includes(addButtonNeedle), 'mobile add button marker missing');
    src = src.replace(addButtonNeedle, `      {filteredSubscribers.length > visibleLimit && (\n        <button\n          type="button"\n          onClick={() => setVisibleLimit(limit => limit + 60)}\n          className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] text-xs font-black text-[#0B1F3B] dark:text-slate-100 active:scale-[0.99]"\n        >\n          عرض المزيد ({Math.min(60, filteredSubscribers.length - visibleLimit)})\n        </button>\n      )}\n\n${addButtonNeedle}`);
  }

  must(src.includes('visibleSubscribers.map'), 'progressive subscriber render missing');
  must(src.includes('useDeferredValue'), 'deferred mobile search missing');
  write(path, src);
}

// 4) iPhone-specific rendering guard: remove expensive backdrop filters and tame decorative animation only on iOS.
{
  const path = 'src/index.css';
  let src = read(path);
  const marker = '/* MOLDATK_IOS_STABILITY_V1 */';
  if (!src.includes(marker)) {
    src += `\n\n${marker}\nhtml.moldatk-ios { scroll-behavior: auto !important; }\nhtml.moldatk-ios body { -webkit-overflow-scrolling: touch; }\nhtml.moldatk-ios [class*="backdrop-blur"] { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\nhtml.moldatk-ios [class*="animate-pulse"] { animation-duration: 3s !important; }\nhtml.moldatk-ios [class*="shadow-2xl"] { box-shadow: 0 10px 28px rgba(11,31,59,.14) !important; }\n`;
  }
  write(path, src);
}

// 5) iPhone detection and calmer service-worker updates. Do not reload an active screen when a worker activates.
{
  const path = 'src/main.tsx';
  let src = read(path);
  must(src, 'main source missing');

  if (!src.includes('MOLDATK_IOS_DEVICE_CLASS_V1')) {
    const marker = "import './index.css';";
    must(src.includes(marker), 'main CSS import marker missing');
    src = src.replace(marker, `${marker}\n\n// MOLDATK_IOS_DEVICE_CLASS_V1\nconst moldatkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||\n  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);\nif (moldatkIOS) document.documentElement.classList.add('moldatk-ios');`);
  }

  src = src.replace(
    /window\.setInterval\(\(\) => void registration\.update\(\),\s*60 \* 1000\);/g,
    "window.setInterval(() => { if (document.visibilityState === 'visible') void registration.update(); }, 5 * 60 * 1000);"
  );
  write(path, src);
}

{
  const path = 'public/sw.js';
  let src = read(path);
  must(src, 'service worker source missing');
  src = src.replace(/\n\s*const windows = await self\.clients\.matchAll\(\{ type: 'window', includeUncontrolled: true \}\);\n\s*for \(const client of windows\) \{[\s\S]*?\n\s*\}\n(?=\s*\}\)\(\)\);)/, '\n    // MOLDATK_IOS_NO_FORCED_CLIENT_RELOAD_V1: active pages adopt the worker without forced navigation.\n');
  must(!src.includes('client.navigate(client.url)'), 'forced service-worker client reload remains');
  write(path, src);
}

console.log('Applied iPhone stability pass: coalesced sync, progressive subscriber DOM, lazy Super Admin bundle, lighter iOS rendering and non-disruptive service worker activation.');

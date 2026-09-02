import fs from 'node:fs';

const navbarPath = 'src/components/Navbar.tsx';
let navbar = fs.readFileSync(navbarPath, 'utf8');
let navbarChanged = false;

if (navbar.includes('  Activity,\n')) {
  navbar = navbar.replace('  Activity,\n', '');
  navbarChanged = true;
}
if (navbar.includes("  const [isOnline, setIsOnline] = useState<boolean>(true);\n")) {
  navbar = navbar.replace("  const [isOnline, setIsOnline] = useState<boolean>(true);\n", '');
  navbarChanged = true;
}
const mobileOldBadge = `            <div className={\`px-2.5 py-1 rounded-full border flex items-center gap-1 text-[10px] font-bold \${\n              isOnline ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'\n            }\`}>\n              <Activity className="w-3 h-3 shrink-0" />\n              <span>{isOnline ? 'متصل' : 'غير متصل'}</span>\n            </div>`;
const desktopOldBadge = `            <div className={\`px-3 py-1.5 rounded-full border flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm \${\n              isOnline ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'\n            }\`}>\n              <Activity className="w-3.5 h-3.5 shrink-0" />\n              <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل بالإنترنت'}</span>\n            </div>`;
const syncSlot = '            <div id="moldatk-sync-status-slot" className="flex items-center shrink-0" />';
if (navbar.includes(mobileOldBadge)) { navbar = navbar.replace(mobileOldBadge, syncSlot); navbarChanged = true; }
if (navbar.includes(desktopOldBadge)) { navbar = navbar.replace(desktopOldBadge, syncSlot); navbarChanged = true; }
if (navbarChanged) fs.writeFileSync(navbarPath, navbar);

const indicatorPath = 'src/components/SyncProgressIndicator.tsx';
let indicator = fs.readFileSync(indicatorPath, 'utf8');

if (!indicator.includes("import { Capacitor } from '@capacitor/core';")) {
  indicator = indicator.replace(
    "import React, { useEffect, useState } from 'react';",
    "import React, { useEffect, useState } from 'react';\nimport { Capacitor } from '@capacitor/core';"
  );
}
if (!indicator.includes("import { createPortal } from 'react-dom';")) {
  indicator = indicator.replace(
    "import React, { useEffect, useState } from 'react';",
    "import React, { useEffect, useState } from 'react';\nimport { createPortal } from 'react-dom';"
  );
}

indicator = indicator.replace(
  "    online: typeof navigator !== 'undefined' ? navigator.onLine : true,",
  "    online: Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true),"
);
indicator = indicator.replace(
  "      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;",
  "      const online = Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true);"
);

indicator = indicator.replace(
`  const label = !state.online || state.pending
    ? 'غير متصل بالإنترنت'
    : state.syncing || completed
      ? \`جاري المزامنة \${Math.max(1, state.progress)}%\`
      : 'متصل بالإنترنت';`,
`  const label = !state.online
    ? 'غير متصل بالإنترنت'
    : state.syncing || completed
      ? \`جاري المزامنة \${Math.max(1, state.progress)}%\`
      : state.pending
        ? 'بانتظار المزامنة'
        : 'متصل بالإنترنت';`
);
indicator = indicator.replace('  const tone = !state.online || state.pending', '  const tone = !state.online');
indicator = indicator.replace('  const dotTone = !state.online || state.pending', '  const dotTone = !state.online');

if (!indicator.includes('const [portalTarget, setPortalTarget]')) {
  indicator = indicator.replace(
    "  const [state, setState] = useState<StatusState>(() => ({\n    online: Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true),\n    syncing: false,\n    progress: 0,\n    pending: false,\n  }));",
    "  const [state, setState] = useState<StatusState>(() => ({\n    online: Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true),\n    syncing: false,\n    progress: 0,\n    pending: false,\n  }));\n  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);\n\n  useEffect(() => {\n    const resolveTarget = () => setPortalTarget(document.getElementById('moldatk-sync-status-slot'));\n    resolveTarget();\n    const timer = window.setInterval(resolveTarget, 400);\n    return () => window.clearInterval(timer);\n  }, []);"
  );
}

const oldReturnStart = `  return (\n    <div\n      dir="rtl"\n      className={\`fixed z-[9999] right-3 max-w-[calc(100vw-24px)] rounded-full border px-2.5 py-1.5 shadow-sm backdrop-blur text-[10px] sm:text-[11px] font-black flex items-center gap-1.5 \${tone}\`}\n      style={{\n        pointerEvents: 'none',\n        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',\n        bottom: 'auto',\n      }}\n      aria-live="polite"\n    >\n      <span className={\`w-1.5 h-1.5 rounded-full shrink-0 \${dotTone}\`} />\n      <span className="whitespace-nowrap">{label}</span>\n    </div>\n  );`;
const newReturn = `  const badge = (\n    <div\n      dir="rtl"\n      className={\`max-w-[calc(100vw-24px)] rounded-full border px-3 py-1.5 shadow-sm backdrop-blur text-[10px] sm:text-[11px] font-black flex items-center gap-1.5 \${tone}\`}\n      style={{ pointerEvents: 'none' }}\n      aria-live="polite"\n    >\n      <span className={\`w-1.5 h-1.5 rounded-full shrink-0 \${dotTone}\`} />\n      <span className="whitespace-nowrap">{label}</span>\n    </div>\n  );\n\n  if (portalTarget) return createPortal(badge, portalTarget);\n\n  return (\n    <div className="fixed z-[9999] left-3" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}>\n      {badge}\n    </div>\n  );`;
if (indicator.includes(oldReturnStart)) indicator = indicator.replace(oldReturnStart, newReturn);

fs.writeFileSync(indicatorPath, indicator);
console.log('Unified sync indicator and fixed Android false-offline state');

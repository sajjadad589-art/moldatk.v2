import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, message) => { if (!ok) throw new Error(`Performance/mobile finalizer: ${message}`); };

// -----------------------------------------------------------------------------
// 1) Mobile dashboard: keep exactly one finance summary row and one debtor modal.
//    This is presentation-only; no financial calculation is changed.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(p);

  const cardMarker = '<section data-ampere-discount-dashboard-mobile-v1';
  const modalMarker = '{showPreviousDebtList && (';
  const cashboxMarker = '      {/* 3. Cashbox */}';

  // Remove duplicate card sections from the end, preserving the first canonical one.
  while ((s.match(/<section data-ampere-discount-dashboard-mobile-v1/g) || []).length > 1) {
    const at = s.lastIndexOf(cardMarker);
    const start = s.lastIndexOf('<section', at);
    const end = s.indexOf('</section>', at);
    must(start >= 0 && end >= 0, 'could not isolate duplicate mobile finance section');
    s = s.slice(0, start) + s.slice(end + '</section>'.length);
  }

  // Remove duplicate debtor modals, preserving the first one.
  while ((s.match(/\{showPreviousDebtList && \(/g) || []).length > 1) {
    const at = s.lastIndexOf(modalMarker);
    const end = s.indexOf(cashboxMarker, at);
    must(at >= 0 && end >= 0, 'could not isolate duplicate mobile debt modal');
    s = s.slice(0, at) + s.slice(end);
  }

  // Remove stale empty comments left by old repeat-build patches.
  s = s.replace(/(?:\s*\{\/\* Ampere discount and previous-month debt controls \*\/\}\s*){2,}/g, '\n');

  must((s.match(/<section data-ampere-discount-dashboard-mobile-v1/g) || []).length === 1,
    'mobile finance section must exist exactly once');
  must((s.match(/\{showPreviousDebtList && \(/g) || []).length === 1,
    'mobile debt modal must exist exactly once');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Service worker: do not reload every open tab on activation. Cache Vite hashed
//    assets aggressively while keeping navigation/version files network-fresh.
// -----------------------------------------------------------------------------
{
  const p = 'public/sw.js';
  let s = read(p);

  s = s.replace(/\n\s*const windows = await self\.clients\.matchAll\([\s\S]*?\n\s*}\n\s*}\)\(\)\);/,
    '\n  })());');

  const oldCondition = "if (request.mode === 'navigate' || url.pathname === '/app-version.json' || url.pathname === '/sw.js' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {";
  const newCondition = "if (request.mode === 'navigate' || url.pathname === '/app-version.json' || url.pathname === '/sw.js') {";
  if (s.includes(oldCondition)) s = s.replace(oldCondition, newCondition);

  if (!s.includes("url.pathname.startsWith('/assets/')")) {
    const anchor = `  if (request.mode === 'navigate' || url.pathname === '/app-version.json' || url.pathname === '/sw.js') {\n`;
    must(s.includes(anchor), 'service worker navigation branch missing');
    const assetBranch = `  if (url.pathname.startsWith('/assets/')) {\n    event.respondWith(caches.match(request).then(cached => {\n      const refresh = fetch(request).then(response => {\n        if (response.ok) {\n          const copy = response.clone();\n          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));\n        }\n        return response;\n      }).catch(() => cached);\n      return cached || refresh;\n    }));\n    return;\n  }\n\n`;
    s = s.replace(anchor, assetBranch + anchor);
  }

  must(!s.includes('client.navigate(client.url)'), 'service worker still force-reloads open tabs');
  must(s.includes("url.pathname.startsWith('/assets/')"), 'asset cache branch missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Browser/PWA update checks: startup check + infrequent foreground check only.
//    Remove the permanent 60-second timer that kept network work alive forever.
// -----------------------------------------------------------------------------
{
  const p = 'src/main.tsx';
  let s = read(p);
  const old = `    navigator.serviceWorker.register('/sw.js?v=1.3.28', { updateViaCache: 'none' }).then(registration => {\n      void registration.update();\n      window.setInterval(() => void registration.update(), 60 * 1000);\n    }).catch(error => {`;
  const replacement = `    navigator.serviceWorker.register('/sw.js?v=1.3.28', { updateViaCache: 'none' }).then(registration => {\n      const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;\n      let lastUpdateCheck = 0;\n      const checkForUpdate = () => {\n        if (document.visibilityState !== 'visible') return;\n        const now = Date.now();\n        if (now - lastUpdateCheck < UPDATE_INTERVAL_MS) return;\n        lastUpdateCheck = now;\n        void registration.update();\n      };\n      checkForUpdate();\n      document.addEventListener('visibilitychange', checkForUpdate);\n    }).catch(error => {`;
  if (s.includes(old)) s = s.replace(old, replacement);
  else {
    s = s.replace(/\s*window\.setInterval\(\(\) => void registration\.update\(\), 60 \* 1000\);/g, '');
  }
  must(!s.includes("setInterval(() => void registration.update(), 60 * 1000)"), '60-second service worker polling still present');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 4) Sync trigger hygiene: keep realtime correctness but stop foreground events from
//    forcing immediate full-table pulls repeatedly. Startup/reconnect/realtime remain.
// -----------------------------------------------------------------------------
{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);

  if (!s.includes('let lastCompletedSyncAt = 0;')) {
    s = s.replace("    let channelSerial = 0;", "    let channelSerial = 0;\n    let lastCompletedSyncAt = 0;");
  }

  // Record a successful sync completion without changing push/pull semantics.
  s = s.replace(
    "      if (!disposed) progress(false, pending());",
    "      if (!disposed) { lastCompletedSyncAt = Date.now(); progress(false, pending()); }"
  );

  // Visibility changes are common on desktop/PWA. Only use them as stale-recovery,
  // not as a normal sync trigger. Realtime events still request immediately.
  s = s.replace(
    "    const visibility = () => { if (document.visibilityState === 'visible') sync.request(); };",
    "    const visibility = () => { if (document.visibilityState === 'visible' && Date.now() - lastCompletedSyncAt > 5 * 60 * 1000) sync.request(); };"
  );

  // BFCache restore must reopen realtime, but an ordinary pageshow must not cause a pull.
  s = s.replace(
    "    const pageshow = (event: PageTransitionEvent) => {\n      if (event.persisted) openRealtimeChannel();\n      sync.request();\n    };",
    "    const pageshow = (event: PageTransitionEvent) => {\n      if (!event.persisted) return;\n      openRealtimeChannel();\n      if (Date.now() - lastCompletedSyncAt > 3000) sync.request();\n    };"
  );

  must(s.includes("Date.now() - lastCompletedSyncAt > 5 * 60 * 1000"), 'visibility stale-recovery throttle missing');
  must(s.includes("if (!event.persisted) return;"), 'pageshow still forces ordinary full pull');
  write(p, s);
}

console.log('Performance finalizer applied: lighter PWA updates/sync triggers and one mobile finance row.');

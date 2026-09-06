import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// -----------------------------------------------------------------------------
// 1) The real collector editor shown in FolderDetailModal: replace the old
// single-select "الخط المخصص" with a checkbox multi-select + "الكل".
// -----------------------------------------------------------------------------
{
  const path = 'src/components/FolderDetailModal.tsx';
  let src = read(path);

  if (!src.includes("from '../lib/collectorCloud'")) {
    src = src.replace(
      "import { formatCurrency, formatNumberArabic } from '../utils/formatters';",
      "import { formatCurrency, formatNumberArabic } from '../utils/formatters';\nimport { syncCloudCollectorRoster } from '../lib/collectorCloud';"
    );
  }

  // New collectors keep the old safe default (first cabinet) but now store it
  // in the multi-cabinet model too.
  if (!src.includes('assignedLineIds: currentLines[0]?.id ? [currentLines[0].id] : []')) {
    src = src.replace(
      "      assignedLineId: currentLines[0]?.id || 'line-1',\n      assignedLineName: currentLines[0]?.name || 'الخط الرئيسي',",
      "      assignedLineId: currentLines[0]?.id || undefined,\n      assignedLineName: currentLines[0]?.name || undefined,\n      assignedLineIds: currentLines[0]?.id ? [currentLines[0].id] : [],\n      assignedAllLines: currentLines.length === 0,"
    );
  }

  if (!src.includes('data-multi-cabinet-picker-v6')) {
    const startNeedle = `                        <div>\n                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">\n                            الخط المخصص`;
    const endNeedle = '                        {/* Passcode Field for Future Login */}';
    const start = src.indexOf(startNeedle);
    const end = src.indexOf(endNeedle, start);
    must(start >= 0 && end > start, 'Actual FolderDetailModal collector line selector not found');

    const picker = `                        <div data-multi-cabinet-picker-v6="true" className="min-w-0">\n                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">\n                            الكابينات المسموحة\n                          </label>\n                          {(() => {\n                            const selectedIds = Array.isArray(c.assignedLineIds) && c.assignedLineIds.length\n                              ? c.assignedLineIds\n                              : (c.assignedLineId ? [c.assignedLineId] : []);\n                            const allSelected = c.assignedAllLines === true || (c.assignedAllLines !== false && selectedIds.length === 0);\n                            const selectedNames = currentLines.filter(line => selectedIds.includes(line.id)).map(line => line.name);\n                            const summaryText = allSelected ? 'الكل' : (selectedNames.length ? selectedNames.join('، ') : 'حدد الكابينات');\n\n                            return (\n                              <details className="group relative">\n                                <summary className="list-none cursor-pointer w-full min-h-[38px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">\n                                  <span className="truncate">{summaryText}</span>\n                                  <span className="text-slate-400 text-[11px] group-open:rotate-180 transition-transform">⌄</span>\n                                </summary>\n                                <div className="mt-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-1.5 shadow-sm">\n                                  <label className={\`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border text-xs font-black \${allSelected ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>\n                                    <input\n                                      type="checkbox"\n                                      checked={allSelected}\n                                      onChange={e => {\n                                        if (e.target.checked) {\n                                          handleUpdateCollector(c.id, {\n                                            assignedAllLines: true,\n                                            assignedLineIds: [],\n                                            assignedLineId: undefined,\n                                            assignedLineName: 'كل الكابينات',\n                                          });\n                                        } else {\n                                          const first = currentLines[0];\n                                          handleUpdateCollector(c.id, {\n                                            assignedAllLines: false,\n                                            assignedLineIds: first ? [first.id] : [],\n                                            assignedLineId: first?.id,\n                                            assignedLineName: first?.name,\n                                          });\n                                        }\n                                      }}\n                                      className="w-4 h-4 accent-[#0B1F3B] shrink-0"\n                                    />\n                                    <span>الكل</span>\n                                  </label>\n\n                                  <div className="max-h-44 overflow-y-auto space-y-1">\n                                    {currentLines.map(line => {\n                                      const checked = !allSelected && selectedIds.includes(line.id);\n                                      return (\n                                        <label key={line.id} className={\`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border text-xs font-bold \${checked ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>\n                                          <input\n                                            type="checkbox"\n                                            checked={checked}\n                                            onChange={() => {\n                                              const next = checked\n                                                ? selectedIds.filter(id => id !== line.id)\n                                                : [...selectedIds, line.id];\n                                              if (checked && next.length === 0) return;\n                                              const first = currentLines.find(item => item.id === next[0]);\n                                              handleUpdateCollector(c.id, {\n                                                assignedAllLines: false,\n                                                assignedLineIds: next,\n                                                assignedLineId: next[0],\n                                                assignedLineName: first?.name,\n                                              });\n                                            }}\n                                            className="w-4 h-4 accent-[#0B1F3B] shrink-0"\n                                          />\n                                          <span className="truncate">{line.name}</span>\n                                        </label>\n                                      );\n                                    })}\n                                  </div>\n                                </div>\n                              </details>\n                            );\n                          })()}\n                        </div>\n\n`;

    src = src.slice(0, start) + picker + src.slice(end);
  }

  // The FolderDetailModal is the UI visible in the user's screenshot. Save its
  // collector changes to Supabase instead of only changing localStorage.
  src = src.replace('  const handleSave = () => {', '  const handleSave = async () => {');
  if (!src.includes('FOLDER_COLLECTOR_SERVER_SAVE_V6')) {
    const oldBranch = `    } else if (folderKey === 'collectors') {\n      onUpdateCollectors(currentCollectors);`;
    must(src.includes(oldBranch), 'FolderDetailModal collector save branch missing');
    src = src.replace(
      oldBranch,
      `    } else if (folderKey === 'collectors') {\n      // FOLDER_COLLECTOR_SERVER_SAVE_V6\n      const invalidCollector = currentCollectors.find(item => item.assignedAllLines === false && !(item.assignedLineIds?.length || item.assignedLineId));\n      if (invalidCollector) {\n        alert('حدد كابينة واحدة على الأقل للجابي أو اختر الكل');\n        return;\n      }\n      try {\n        const savedCollectors = await syncCloudCollectorRoster(currentCollectors);\n        const finalCollectors = savedCollectors.length ? savedCollectors : currentCollectors;\n        setCurrentCollectors(finalCollectors);\n        onUpdateCollectors(finalCollectors);\n      } catch (error) {\n        console.error('Folder collector server save failed:', error);\n        alert('تعذر حفظ تخصيص الكابينات على السيرفر. لم يتم إغلاق النافذة.');\n        return;\n      }`
    );
  }

  write(path, src);
}

// -----------------------------------------------------------------------------
// 2) POS: support old subscribers that have only lineName/line while still
// hiding every cabinet that the collector was not assigned.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/POSQuickView.tsx';
  let src = read(path);
  src = src.replace(
    ": subscribers.filter(sub => Boolean(sub.lineId && accessibleLineIds.has(sub.lineId)));",
    `: subscribers.filter(sub => {\n        const resolvedLineId = sub.lineId || lines.find(line => line.name === (sub.lineName || sub.line || ''))?.id;\n        return Boolean(resolvedLineId && accessibleLineIds.has(resolvedLineId));\n      });`
  );
  write(path, src);
}

// -----------------------------------------------------------------------------
// 3) iPhone/PWA icon: use a new URL generation so Safari does not keep the old
// home-screen artwork. The v5 PNGs are already generated from the approved
// Moldatk generator mark; v6 copies the same artwork under fresh immutable URLs.
// -----------------------------------------------------------------------------
{
  fs.mkdirSync('public/icons', { recursive: true });
  const copies = [
    ['public/icons/moldatk-apple-touch-v5.png', 'public/icons/moldatk-apple-touch-v6.png'],
    ['public/icons/moldatk-icon-192-v5.png', 'public/icons/moldatk-icon-192-v6.png'],
    ['public/icons/moldatk-icon-512-v5.png', 'public/icons/moldatk-icon-512-v6.png'],
  ];
  for (const [from, to] of copies) {
    must(fs.existsSync(from), `Base PWA brand icon missing: ${from}`);
    fs.copyFileSync(from, to);
  }

  const indexPath = 'index.html';
  let index = read(indexPath)
    .replaceAll('/manifest.webmanifest?v=5', '/manifest.webmanifest?v=6')
    .replaceAll('/brand/moldatk-mark.svg?v=5', '/brand/moldatk-mark.svg?v=6')
    .replaceAll('/icons/moldatk-apple-touch-v5.png', '/icons/moldatk-apple-touch-v6.png')
    .replaceAll('/pwa-recovery-v5.js', '/pwa-recovery-v6.js');
  write(indexPath, index);

  write('public/pwa-recovery-v6.js', `(() => {\n  const VERSION = 'moldatk-pwa-recovery-v6-1.3.19';\n  const STORAGE_KEY = 'moldatk_pwa_recovery_version';\n  const RELOAD_KEY = 'moldatk_pwa_recovery_reloaded_v6';\n  try {\n    if (localStorage.getItem(STORAGE_KEY) === VERSION) return;\n    localStorage.setItem(STORAGE_KEY, VERSION);\n  } catch (_) {}\n  const recover = async () => {\n    try {\n      if ('serviceWorker' in navigator) {\n        const registrations = await navigator.serviceWorker.getRegistrations();\n        await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)));\n      }\n    } catch (_) {}\n    try {\n      if ('caches' in window) {\n        const cacheKeys = await caches.keys();\n        await Promise.all(cacheKeys.map(key => caches.delete(key).catch(() => false)));\n      }\n    } catch (_) {}\n    try {\n      if (!sessionStorage.getItem(RELOAD_KEY)) {\n        sessionStorage.setItem(RELOAD_KEY, '1');\n        const url = new URL(window.location.href);\n        url.searchParams.set('_moldatk_refresh', Date.now().toString());\n        window.location.replace(url.toString());\n      }\n    } catch (_) { window.location.reload(); }\n  };\n  void recover();\n})();\n`);

  write('public/manifest.webmanifest', JSON.stringify({
    id: '/?pwa=6',
    name: 'مولدتك',
    short_name: 'مولدتك',
    description: 'نظام إدارة المولدات الكهربائية والاشتراكات والجباية',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/?pwa=6',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0B1F3B',
    theme_color: '#0B1F3B',
    icons: [
      { src: '/icons/moldatk-icon-192-v6.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/moldatk-icon-512-v6.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/moldatk-icon-512-v6.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n');

  for (const path of ['public/sw.js', 'src/main.tsx']) {
    let content = read(path).replaceAll('1.3.18', '1.3.19').replaceAll('1.3.17', '1.3.19');
    content = content.replaceAll('/icons/icon-192.png', '/icons/moldatk-icon-192-v6.png');
    write(path, content);
  }
}

// Final guards for this exact user-visible fix.
const folder = read('src/components/FolderDetailModal.tsx');
const pos = read('src/components/POSQuickView.tsx');
const index = read('index.html');
const manifest = read('public/manifest.webmanifest');
must(folder.includes('data-multi-cabinet-picker-v6') && folder.includes('FOLDER_COLLECTOR_SERVER_SAVE_V6'), 'Actual collector multi-cabinet picker/server save missing');
must(folder.includes("<span>الكل</span>") && folder.includes('type="checkbox"'), 'Collector picker checkbox/all option missing');
must(pos.includes('resolvedLineId') && pos.includes('accessibleSubscribers'), 'Collector POS cabinet visibility guard missing');
must(index.includes('moldatk-apple-touch-v6.png') && index.includes('pwa-recovery-v6.js'), 'iPhone icon v6 link missing');
must(manifest.includes('moldatk-icon-192-v6.png') && manifest.includes('/?pwa=6'), 'PWA v6 manifest missing');
for (const iconPath of ['public/icons/moldatk-apple-touch-v6.png', 'public/icons/moldatk-icon-192-v6.png', 'public/icons/moldatk-icon-512-v6.png']) {
  must(fs.existsSync(iconPath) && fs.statSync(iconPath).size > 1000, `PWA v6 icon missing: ${iconPath}`);
}

console.log('Applied actual FolderDetailModal multi-cabinet checkbox picker, server persistence, collector visibility scope and iPhone/PWA icon v6.');

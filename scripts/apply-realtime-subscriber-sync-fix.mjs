import fs from 'node:fs';

const appPath = 'src/App.tsx';
let source = fs.readFileSync(appPath, 'utf8');
let changed = false;

const syncImport = "import { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';";
const persistImport = "import { persistCollectorSubscriber } from './lib/subscriberCloud';";
if (!source.includes(syncImport) || !source.includes(persistImport)) {
  const importMarker = "import { supabase } from './lib/supabase';";
  if (!source.includes(importMarker)) throw new Error('Supabase import marker not found in src/App.tsx');
  const additions = [
    !source.includes(syncImport) ? syncImport : '',
    !source.includes(persistImport) ? persistImport : '',
  ].filter(Boolean).join('\n');
  source = source.replace(importMarker, `${importMarker}\n${additions}`);
  changed = true;
}

source = source.replace(
  /export default function App\(\{ forceSuperAdmin = false \}: AppProps\) \{\n\s*\/\/ تشغيل مزامنة Supabase المركزية[^\n]*\n\s*\/\/ أي إضافة\/تعديل\/حذف[^\n]*\n\s*useGeneratorCloudSync\(userSession\);/,
  'export default function App({ forceSuperAdmin = false }: AppProps) {'
);

if (!source.includes('useGeneratorCloudSync(userSession);')) {
  const hookMarker = "\n\n  const getStorageKey = (baseKey: string, session: ActiveUserSession | null = userSession) => {";
  if (!source.includes(hookMarker)) throw new Error('Safe sync hook marker not found in src/App.tsx');
  source = source.replace(
    hookMarker,
    `\n\n  // مزامنة مركزية: أي إضافة/تعديل/حذف للمشتركين تنتقل بين كل الأجهزة التابعة لنفس المولدة.\n  useGeneratorCloudSync(userSession);${hookMarker}`
  );
  changed = true;
}

const oldSave = `  const handleSaveSubscriber = (newSub: Subscriber) => {\n    setSubscribers(prev => {\n      const exists = prev.some(s => s.id === newSub.id);\n      const normalizedSub: Subscriber = {\n        ...newSub,\n        code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(prev),\n        subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(prev),\n        line: newSub.line || newSub.lineName,\n        lineName: newSub.lineName || newSub.line,\n      };\n      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];\n      try {\n        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}\n      return updated;\n    });\n    setSubscriberToEdit(newSub);\n    showToast('تم حفظ بيانات المشترك بنجاح');\n  };`;

const newSave = [
  '  const handleSaveSubscriber = async (newSub: Subscriber) => {',
  '    const matchedTier = pricingTiers.find(t => t.id === newSub.tier || t.type === newSub.tier);',
  '    const matchedLine = lines.find(l => l.id === newSub.lineId || l.name === newSub.lineName || l.name === newSub.line);',
  '    const rawTier = String(newSub.tier || \'normal\').replace(/^tier-/, \'\');',
  "    const normalizedTier = (matchedTier?.type || (['normal', 'commercial', 'golden', 'free', 'custom'].includes(rawTier) ? rawTier : 'normal')) as Subscriber['tier'];",
  '    const normalizedSub: Subscriber = {',
  '      ...newSub,',
  '      code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(subscribers),',
  '      subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(subscribers),',
  '      tier: normalizedTier,',
  '      lineId: matchedLine?.id || newSub.lineId,',
  '      line: matchedLine?.name || newSub.line || newSub.lineName,',
  '      lineName: matchedLine?.name || newSub.lineName || newSub.line,',
  '    };',
  '',
  "    const shouldSyncCloud = (userSession?.role === 'generator_admin' || userSession?.role === 'collector') && Boolean(userSession.generatorId);",
  "    const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;",
  '    let cloudSynced = false;',
  '',
  '    if (shouldSyncCloud && onlineNow && userSession?.generatorId) {',
  '      try {',
  '        await persistCollectorSubscriber(userSession.generatorId, normalizedSub);',
  '        cloudSynced = true;',
  '      } catch (error: any) {',
  "        console.error('Subscriber cloud save deferred:', error);",
  '      }',
  '    }',
  '',
  '    // مهم: الحفظ المحلي يتم دائماً. إذا كان الجهاز أوفلاين تبقى العملية بانتظار محرك المزامنة.',
  '    setSubscribers(prev => {',
  '      const exists = prev.some(s => s.id === normalizedSub.id);',
  '      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];',
  '      try {',
  "        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));",
  "        window.dispatchEvent(new Event('moldatk-local-sync'));",
  '      } catch (e) {}',
  '      return updated;',
  '    });',
  '    setSubscriberToEdit(normalizedSub);',
  '',
  '    if (shouldSyncCloud && !cloudSynced) {',
  '      try {',
  "        window.dispatchEvent(new CustomEvent('moldatk-sync-progress', { detail: { active: false, progress: 0, pending: true, message: 'محفوظ محلياً — بانتظار المزامنة' } }));",
  '      } catch (e) {}',
  "      showToast(onlineNow ? 'تم الحفظ محلياً وستتم إعادة المزامنة تلقائياً' : 'تم الحفظ بدون إنترنت وسيتم رفعه عند رجوع الاتصال');",
  '    } else {',
  "      showToast('تم حفظ بيانات المشترك ومزامنتها بنجاح');",
  '    }',
  '  };',
].join('\n');

if (source.includes(oldSave)) {
  source = source.replace(oldSave, newSave);
  changed = true;
} else if (source.includes('const handleSaveSubscriber = async (newSub: Subscriber)')) {
  const start = source.indexOf('  const handleSaveSubscriber = async (newSub: Subscriber) => {');
  const end = source.indexOf('\n\n  const addAuditLog =', start);
  if (start >= 0 && end > start) {
    source = source.slice(0, start) + newSave + source.slice(end);
    changed = true;
  }
} else {
  throw new Error('Subscriber save handler marker not found in src/App.tsx');
}

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log('Applied realtime sync with offline-first subscriber/payment persistence');
} else {
  console.log('Realtime subscriber/cloud sync already applied');
}

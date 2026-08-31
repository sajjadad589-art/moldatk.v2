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

// Remove an older unsafe placement if a previous patch inserted the hook before userSession exists.
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

const newSave = `  const handleSaveSubscriber = async (newSub: Subscriber) => {\n    const normalizedSub: Subscriber = {\n      ...newSub,\n      code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(subscribers),\n      subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(subscribers),\n      line: newSub.line || newSub.lineName,\n      lineName: newSub.lineName || newSub.line,\n    };\n\n    // للحسابات المرتبطة بمولدة، Supabase هو المصدر الرئيسي للحفظ.\n    // لا نعرض نجاحاً للمستخدم إلا بعد تأكيد قاعدة البيانات للحفظ.\n    if ((userSession?.role === 'generator_admin' || userSession?.role === 'collector') && userSession.generatorId) {\n      try {\n        await persistCollectorSubscriber(userSession.generatorId, normalizedSub);\n      } catch (error: any) {\n        console.error('Subscriber cloud save failed:', error);\n        showToast(error?.message ? `تعذر حفظ المشترك: ${error.message}` : 'تعذر حفظ المشترك على الخادم');\n        return;\n      }\n    }\n\n    setSubscribers(prev => {\n      const exists = prev.some(s => s.id === normalizedSub.id);\n      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];\n      try {\n        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}\n      return updated;\n    });\n    setSubscriberToEdit(normalizedSub);\n    showToast('تم حفظ بيانات المشترك ومزامنتها بنجاح');\n  };`;

if (source.includes(oldSave)) {
  source = source.replace(oldSave, newSave);
  changed = true;
} else if (!source.includes("const handleSaveSubscriber = async (newSub: Subscriber)")) {
  throw new Error('Subscriber save handler marker not found in src/App.tsx');
}

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log('Applied safe realtime subscriber sync and cloud-first save to src/App.tsx');
} else {
  console.log('Realtime subscriber/cloud sync already applied');
}

import fs from 'node:fs';

const file = 'src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

const importAnchor = "import { supabase } from './lib/supabase';\n";
const syncImport = "import { loadSubscribers, upsertSubscriber, deleteSubscriber, subscribeToGeneratorChanges } from './lib/sharedData';\n";
if (!src.includes(syncImport)) {
  if (!src.includes(importAnchor)) throw new Error('Supabase import anchor not found');
  src = src.replace(importAnchor, importAnchor + syncImport);
}

const effectAnchor = `  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);`;
const cloudEffect = `  // مزامنة المشتركين بين Android و iPhone Web App والكمبيوتر عبر Supabase.\n  // localStorage يبقى كـ cache محلي فقط حتى تفتح الواجهة بسرعة، بينما المصدر المركزي هو Supabase.\n  useEffect(() => {\n    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) return;\n\n    const generatorId = userSession.generatorId;\n    let disposed = false;\n    let refreshing = false;\n    const migrationMarker = 'moldatk_cloud_subscribers_migrated_' + generatorId;\n\n    const refreshFromCloud = async () => {\n      if (refreshing) return;\n      refreshing = true;\n      try {\n        const cloudSubscribers = await loadSubscribers(generatorId);\n        if (disposed) return;\n\n        const localSubscribers = readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession);\n        const alreadyMigrated = localStorage.getItem(migrationMarker) === '1';\n\n        // أول تشغيل بعد إضافة المزامنة: إذا السيرفر فارغ والجهاز عنده بيانات قديمة،\n        // نرفعها مرة واحدة فقط حتى لا نخسر المشتركين الحاليين.\n        if (!alreadyMigrated && cloudSubscribers.length === 0 && localSubscribers.length > 0) {\n          await Promise.all(localSubscribers.map(sub => upsertSubscriber(generatorId, sub)));\n          if (disposed) return;\n          localStorage.setItem(migrationMarker, '1');\n          setSubscribers(localSubscribers);\n          return;\n        }\n\n        localStorage.setItem(migrationMarker, '1');\n        setSubscribers(cloudSubscribers);\n        localStorage.setItem(getStorageKey('moldatk_subscribers', userSession), JSON.stringify(cloudSubscribers));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (error) {\n        console.error('Cloud subscriber sync failed:', error);\n        // عند انقطاع الإنترنت نترك نسخة الـ cache الحالية بدون تعطيل التطبيق.\n      } finally {\n        refreshing = false;\n      }\n    };\n\n    void refreshFromCloud();\n    const unsubscribe = subscribeToGeneratorChanges(generatorId, () => { void refreshFromCloud(); });\n\n    const onOnline = () => void refreshFromCloud();\n    window.addEventListener('online', onOnline);\n\n    return () => {\n      disposed = true;\n      unsubscribe();\n      window.removeEventListener('online', onOnline);\n    };\n  }, [userSession?.role, userSession?.generatorId]);\n\n`;

if (!src.includes('moldatk_cloud_subscribers_migrated_')) {
  if (!src.includes(effectAnchor)) throw new Error('Receipt state anchor not found');
  src = src.replace(effectAnchor, cloudEffect + effectAnchor);
}

const oldSave = `  const handleSaveSubscriber = (newSub: Subscriber) => {\n    setSubscribers(prev => {\n      const exists = prev.some(s => s.id === newSub.id);\n      const normalizedSub: Subscriber = {\n        ...newSub,\n        code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(prev),\n        subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(prev),\n        line: newSub.line || newSub.lineName,\n        lineName: newSub.lineName || newSub.line,\n      };\n      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];\n      try {\n        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}\n      return updated;\n    });\n    setSubscriberToEdit(newSub);\n    showToast('تم حفظ بيانات المشترك بنجاح');\n  };`;

const newSave = `  const handleSaveSubscriber = (newSub: Subscriber) => {\n    const exists = subscribers.some(s => s.id === newSub.id);\n    const generatedCode = newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(subscribers);\n    const normalizedSub: Subscriber = {\n      ...newSub,\n      code: generatedCode,\n      subscriberCode: generatedCode,\n      line: newSub.line || newSub.lineName,\n      lineName: newSub.lineName || newSub.line,\n    };\n    const updated = exists\n      ? subscribers.map(s => (s.id === normalizedSub.id ? normalizedSub : s))\n      : [normalizedSub, ...subscribers];\n\n    setSubscribers(updated);\n    try {\n      localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n    } catch (e) {}\n\n    if (userSession?.role === 'generator_admin' && userSession.generatorId) {\n      void upsertSubscriber(userSession.generatorId, normalizedSub).catch(error => {\n        console.error('Failed to save subscriber to Supabase:', error);\n        showToast('تم الحفظ على الجهاز، وتعذرت المزامنة. ستتم المحاولة عند رجوع الإنترنت.');\n      });\n    }\n\n    setSubscriberToEdit(normalizedSub);\n    showToast('تم حفظ بيانات المشترك بنجاح');\n  };\n\n  const handleDeleteSubscriber = (subId: string) => {\n    const updated = subscribers.filter(s => s.id !== subId);\n    setSubscribers(updated);\n    try {\n      localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n    } catch (e) {}\n\n    if (userSession?.role === 'generator_admin' && userSession.generatorId) {\n      void deleteSubscriber(userSession.generatorId, subId).catch(error => {\n        console.error('Failed to delete subscriber from Supabase:', error);\n        showToast('انحذف من الجهاز، لكن تعذرت مزامنة الحذف حالياً.');\n      });\n    }\n    showToast('تم حذف المشترك بنجاح');\n  };`;

if (src.includes(oldSave)) {
  src = src.replace(oldSave, newSave);
} else if (!src.includes('const handleDeleteSubscriber = (subId: string)')) {
  throw new Error('Subscriber save handler anchor not found');
}

const mobileDelete = `          onDeleteSubscriber={subId => {\n            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;\n            });\n            showToast('تم حذف المشترك بنجاح');\n          }}`;
if (src.includes(mobileDelete)) {
  src = src.replace(mobileDelete, `          onDeleteSubscriber={handleDeleteSubscriber}`);
}

const modalDelete = `          onDeleteSubscriber={(subId) => {\n            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              return updated;\n            });\n            setIsSubscriberModalOpen(false);\n          }}`;
if (src.includes(modalDelete)) {
  src = src.replace(modalDelete, `          onDeleteSubscriber={(subId) => { handleDeleteSubscriber(subId); setIsSubscriberModalOpen(false); }}`);
}

fs.writeFileSync(file, src);
console.log('Shared subscriber cloud sync applied');

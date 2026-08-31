import fs from 'node:fs';

const file = 'src/App.tsx';
let app = fs.readFileSync(file, 'utf8');

if (!app.includes('const handleUpdateCollectorsCloud = async (newCollectors: Collector[]) =>')) {
  const anchor = "  const showToast = (msg: string) => {\n    setToastMessage(msg);\n    setTimeout(() => setToastMessage(null), 3500);\n  };";
  const helper = `${anchor}\n\n  const handleUpdateCollectorsCloud = async (newCollectors: Collector[]) => {\n    const scopedCollectors = newCollectors.map(c => ({\n      ...c,\n      generatorId: userSession?.generatorId || c.generatorId || null,\n    }));\n\n    try {\n      const savedCollectors = await syncCloudCollectorRoster(scopedCollectors);\n      const persistedCollectors = savedCollectors.map(c => ({\n        ...c,\n        generatorId: userSession?.generatorId || c.generatorId || null,\n      }));\n      setCollectors(persistedCollectors);\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(persistedCollectors));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n      showToast('تم إنشاء وحفظ حسابات الجباة بنجاح');\n    } catch (error) {\n      console.error('Collector account sync failed:', error);\n      showToast('فشل إنشاء حساب الجابي على السيرفر. تأكد من رقم الهاتف والرمز السري ثم أعد المحاولة');\n    }\n  };`;
  app = app.replace(anchor, helper);
}

const simple = `onUpdateCollectors={(newCollectors) => {\n            setCollectors(newCollectors);\n            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n          }}`;
app = app.split(simple).join('onUpdateCollectors={handleUpdateCollectorsCloud}');

const scopedTry = `onUpdateCollectors={newCollectors => {\n                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n                setCollectors(scopedCollectors);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;
app = app.split(scopedTry).join('onUpdateCollectors={handleUpdateCollectorsCloud}');

const scopedDirect = `onUpdateCollectors={(newCollectors) => {\n          const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n          setCollectors(scopedCollectors);\n          localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n          window.dispatchEvent(new Event('moldatk-local-sync'));\n        }}`;
app = app.split(scopedDirect).join('onUpdateCollectors={handleUpdateCollectorsCloud}');

fs.writeFileSync(file, app);
console.log('Collector cloud callbacks applied safely');

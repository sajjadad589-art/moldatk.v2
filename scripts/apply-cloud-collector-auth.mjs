import fs from 'node:fs';

// 1) Make collector login use Supabase Auth instead of device-only localStorage.
{
  const file = 'src/components/LoginView.tsx';
  let src = fs.readFileSync(file, 'utf8');
  const anchor = "import { supabase } from '../lib/supabase';\n";
  const cloudImport = "import { loginCollectorWithCloud } from '../lib/collectorCloud';\n";
  if (!src.includes(cloudImport)) {
    if (!src.includes(anchor)) throw new Error('LoginView supabase import anchor not found');
    src = src.replace(anchor, anchor + cloudImport);
  }

  const oldBranch = `    } else {\n      const collector = collectors.find(c => c.phone.trim() === cleanInput && (c.passcode || '1234').trim() === cleanPass);\n\n      if (collector) {\n        onLoginSuccess({\n          role: 'collector',\n          collectorId: collector.id,\n          collectorName: collector.name,\n          generatorId: collector.generatorId || null,\n          loginTime: new Date().toISOString(),\n        });\n      } else {\n        setErrorMessage('رقم الهاتف أو الرمز السري للجابي غير صحيح');\n      }\n    }`;
  const newBranch = `    } else {\n      setIsSubmitting(true);\n      try {\n        const session = await loginCollectorWithCloud(cleanInput, cleanPass);\n        onLoginSuccess(session);\n      } catch (error) {\n        console.error('Collector cloud login failed:', error);\n        setErrorMessage('رقم الهاتف أو الرمز السري للجابي غير صحيح أو الحساب موقوف');\n      } finally {\n        setIsSubmitting(false);\n      }\n    }`;
  if (src.includes(oldBranch)) src = src.replace(oldBranch, newBranch);
  else if (!src.includes('loginCollectorWithCloud(cleanInput, cleanPass)')) throw new Error('Collector login branch not found');
  fs.writeFileSync(file, src);
}

// 2) Sync the collector roster for the generator account and migrate existing local collectors once.
{
  const file = 'src/App.tsx';
  let src = fs.readFileSync(file, 'utf8');
  const importAnchor = "import { supabase } from './lib/supabase';\n";
  const cloudImport = "import { loadCloudCollectors, syncCloudCollectorRoster } from './lib/collectorCloud';\n";
  if (!src.includes(cloudImport)) {
    if (!src.includes(importAnchor)) throw new Error('App supabase import anchor not found');
    src = src.replace(importAnchor, importAnchor + cloudImport);
  }

  const effectAnchor = `  const [pricingModalOpen, setPricingModalOpen] = useState(false);`;
  const effect = `  // الجباة صاروا حسابات Supabase حقيقية حتى يشتغل نفس الجابي من أي جهاز.\n  useEffect(() => {\n    if (!userSession?.generatorId || (userSession.role !== 'generator_admin' && userSession.role !== 'collector')) return;\n    const generatorId = userSession.generatorId;\n    let disposed = false;\n\n    const refreshCollectorsFromCloud = async () => {\n      try {\n        let cloudCollectors = await loadCloudCollectors(generatorId);\n        if (disposed) return;\n\n        if (userSession.role === 'generator_admin' && cloudCollectors.length === 0) {\n          const localCollectors = readLocalJson<Collector[]>('moldatk_collectors', [], userSession);\n          if (localCollectors.length > 0) {\n            cloudCollectors = await syncCloudCollectorRoster(localCollectors.map(c => ({ ...c, generatorId })));\n            if (disposed) return;\n            cloudCollectors = cloudCollectors.map(serverCollector => {\n              const local = localCollectors.find(c => String(c.phone).replace(/\\D/g, '') === String(serverCollector.phone).replace(/\\D/g, ''));\n              return { ...serverCollector, passcode: local?.passcode || '' };\n            });\n          }\n        }\n\n        setCollectors(cloudCollectors);\n        localStorage.setItem(getStorageKey('moldatk_collectors', userSession), JSON.stringify(cloudCollectors));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (error) {\n        console.error('Cloud collectors load failed:', error);\n      }\n    };\n\n    void refreshCollectorsFromCloud();\n    const onOnline = () => void refreshCollectorsFromCloud();\n    window.addEventListener('online', onOnline);\n    return () => { disposed = true; window.removeEventListener('online', onOnline); };\n  }, [userSession?.role, userSession?.generatorId]);\n\n  const handleUpdateCollectorsCloud = (newCollectors: Collector[]) => {\n    const generatorId = userSession?.generatorId || null;\n    const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: generatorId || c.generatorId || null }));\n    setCollectors(scopedCollectors);\n    try {\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n    } catch (e) {}\n\n    if (userSession?.role === 'generator_admin' && generatorId) {\n      void syncCloudCollectorRoster(scopedCollectors).then(serverCollectors => {\n        const merged = serverCollectors.map(serverCollector => {\n          const local = scopedCollectors.find(c => String(c.phone).replace(/\\D/g, '') === String(serverCollector.phone).replace(/\\D/g, ''));\n          return { ...serverCollector, passcode: local?.passcode || '' };\n        });\n        setCollectors(merged);\n        localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(merged));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n        showToast('تم حفظ حسابات الجباة ومزامنتها بنجاح');\n      }).catch(error => {\n        console.error('Collector roster sync failed:', error);\n        showToast('تعذر حفظ حسابات الجباة على السيرفر. تأكد من رقم الهاتف والرمز وحاول مرة أخرى.');\n      });\n    }\n  };\n\n`;
  if (!src.includes('const handleUpdateCollectorsCloud = (newCollectors: Collector[])')) {
    if (!src.includes(effectAnchor)) throw new Error('Pricing modal anchor not found');
    src = src.replace(effectAnchor, effect + effectAnchor);
  }

  const simpleBlock = `          onUpdateCollectors={(newCollectors) => {\n            setCollectors(newCollectors);\n            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n          }}`;
  src = src.split(simpleBlock).join(`          onUpdateCollectors={handleUpdateCollectorsCloud}`);

  const scopedBlock = `              onUpdateCollectors={newCollectors => {\n                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n                setCollectors(scopedCollectors);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;
  src = src.split(scopedBlock).join(`              onUpdateCollectors={handleUpdateCollectorsCloud}`);

  const scopedBlock2 = `        onUpdateCollectors={(newCollectors) => {\n          const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n          setCollectors(scopedCollectors);\n          localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n          window.dispatchEvent(new Event('moldatk-local-sync'));\n        }}`;
  src = src.split(scopedBlock2).join(`        onUpdateCollectors={handleUpdateCollectorsCloud}`);

  fs.writeFileSync(file, src);
}

console.log('Cloud collector authentication and roster sync applied');

import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Collector settings UI: save collector changes on the server before closing.
{
  const p = 'src/components/FolderDetailModal.tsx';
  let c = read(p);

  c = c.replace(
    '  onUpdateCollectors: (collectors: Collector[]) => void;',
    '  onUpdateCollectors: (collectors: Collector[]) => void | Promise<void>;'
  );

  if (!c.includes('const handleSave = async () => {')) {
    c = c.replace(
      "  const handleSave = () => {\n    if (folderKey === 'generator_specs') {\n      onUpdateGeneratorSpecs(specs);\n    } else if (folderKey === 'lines_zones') {\n      onUpdateLines(currentLines);\n    } else if (folderKey === 'collectors') {\n      onUpdateCollectors(currentCollectors);\n    } else if (folderKey === 'invoices_templates') {\n      onUpdateInvoiceTemplate(currentTemplate);\n    }\n\n    setSaved(true);\n    setTimeout(() => {\n      setSaved(false);\n      onClose();\n    }, 600);\n  };",
      "  const handleSave = async () => {\n    try {\n      if (folderKey === 'generator_specs') {\n        onUpdateGeneratorSpecs(specs);\n      } else if (folderKey === 'lines_zones') {\n        onUpdateLines(currentLines);\n      } else if (folderKey === 'collectors') {\n        await onUpdateCollectors(currentCollectors);\n      } else if (folderKey === 'invoices_templates') {\n        onUpdateInvoiceTemplate(currentTemplate);\n      }\n\n      setSaved(true);\n      setTimeout(() => {\n        setSaved(false);\n        onClose();\n      }, 600);\n    } catch (error) {\n      console.error('Collector settings save failed:', error);\n      alert(folderKey === 'collectors' ? 'تعذر حفظ بيانات الجابي على السيرفر. لم يتم اعتماد التغييرات.' : 'تعذر حفظ التغييرات');\n    }\n  };"
    );
  }

  c = c.replaceAll("value={c.passcode || '1234'}", "value={c.passcode || ''}");
  c = c.replaceAll('placeholder="مثال: 1234"', 'placeholder="اكتب رمزاً جديداً أو اتركه بدون تغيير"');

  write(p, c);
}

// App: every collector editor must use the same cloud-backed save handler.
{
  const p = 'src/App.tsx';
  let c = read(p);

  c = c
    .split('\n')
    .filter(line => !line.includes("./lib/collectorCloud"))
    .join('\n');
  c = c.replace(
    "import { supabase } from './lib/supabase';",
    "import { supabase } from './lib/supabase';\nimport { syncCloudCollectorRoster } from './lib/collectorCloud';"
  );

  const marker = "  const handleOpenFolderModal = (folderKey: string) => setActiveSettingsFolderKey(folderKey);";
  if (!c.includes('const handleUpdateCollectors = async (newCollectors: Collector[])')) {
    const handler = `  const handleUpdateCollectors = async (newCollectors: Collector[]) => {\n    const normalizePhone = (value: string) => String(value || '').replace(/\\D/g, '');\n    const seenPhones = new Set<string>();\n    const scopedCollectors = newCollectors.map(item => ({\n      ...item,\n      generatorId: userSession?.generatorId || item.generatorId || undefined,\n      phone: normalizePhone(item.phone),\n    }));\n\n    for (const collector of scopedCollectors) {\n      if (collector.phone.length < 10) throw new Error('invalid_collector_phone');\n      if (seenPhones.has(collector.phone)) throw new Error('duplicate_collector_phone');\n      seenPhones.add(collector.phone);\n      const pin = String(collector.passcode || '').trim();\n      if (pin && !/^\\d{4,8}$/.test(pin)) throw new Error('invalid_collector_pin');\n    }\n\n    const previous = collectors;\n    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {\n      setCollectors(scopedCollectors);\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n      return;\n    }\n\n    try {\n      const saved = await syncCloudCollectorRoster(scopedCollectors);\n      setCollectors(saved);\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(saved));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n      showToast('تم حفظ بيانات الجباة وتحديث تسجيل الدخول');\n    } catch (error) {\n      setCollectors(previous);\n      try { localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(previous)); } catch (e) {}\n      throw error;\n    }\n  };\n\n`;
    if (!c.includes(marker)) throw new Error('handleOpenFolderModal marker not found');
    c = c.replace(marker, handler + marker);
  }

  const localSimple = `          onUpdateCollectors={(newCollectors) => {\n            setCollectors(newCollectors);\n            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n          }}`;
  const scopedTry = `              onUpdateCollectors={newCollectors => {\n                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n                setCollectors(scopedCollectors);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;
  const scopedPlain = `        onUpdateCollectors={(newCollectors) => {\n          const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));\n          setCollectors(scopedCollectors);\n          localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));\n          window.dispatchEvent(new Event('moldatk-local-sync'));\n        }}`;

  c = c.replaceAll(localSimple, '          onUpdateCollectors={handleUpdateCollectors}');
  c = c.replaceAll(scopedTry, '              onUpdateCollectors={handleUpdateCollectors}');
  c = c.replaceAll(scopedPlain, '        onUpdateCollectors={handleUpdateCollectors}');

  // Fail the build if a FolderDetailModal still has a local-only collector callback.
  if (/onUpdateCollectors=\{(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.test(c)) {
    throw new Error('A local-only onUpdateCollectors callback remains in App.tsx');
  }

  write(p, c);
}

console.log('Applied collector server-save to every editor path');

import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Collector settings UI: never display a fake PIN for cloud-loaded collectors,
// and wait for the cloud account save before closing the modal.
{
  const p = 'src/components/FolderDetailModal.tsx';
  let c = read(p);

  c = c.replace(
    '  onUpdateCollectors: (collectors: Collector[]) => void;',
    '  onUpdateCollectors: (collectors: Collector[]) => void | Promise<void>;'
  );

  c = c.replace(
    "  const handleSave = () => {\n    if (folderKey === 'generator_specs') {\n      onUpdateGeneratorSpecs(specs);\n    } else if (folderKey === 'lines_zones') {\n      onUpdateLines(currentLines);\n    } else if (folderKey === 'collectors') {\n      onUpdateCollectors(currentCollectors);\n    } else if (folderKey === 'invoices_templates') {\n      onUpdateInvoiceTemplate(currentTemplate);\n    }\n\n    setSaved(true);\n    setTimeout(() => {\n      setSaved(false);\n      onClose();\n    }, 600);\n  };",
    "  const handleSave = async () => {\n    try {\n      if (folderKey === 'generator_specs') {\n        onUpdateGeneratorSpecs(specs);\n      } else if (folderKey === 'lines_zones') {\n        onUpdateLines(currentLines);\n      } else if (folderKey === 'collectors') {\n        await onUpdateCollectors(currentCollectors);\n      } else if (folderKey === 'invoices_templates') {\n        onUpdateInvoiceTemplate(currentTemplate);\n      }\n\n      setSaved(true);\n      setTimeout(() => {\n        setSaved(false);\n        onClose();\n      }, 600);\n    } catch (error) {\n      console.error('Settings save failed:', error);\n      alert(folderKey === 'collectors' ? 'تعذر حفظ حساب الجابي على السيرفر. تحقق من رقم الهاتف والرمز السري ثم حاول مرة أخرى.' : 'تعذر حفظ التغييرات');\n    }\n  };"
  );

  // Cloud-loaded collectors intentionally have passcode=''. Showing 1234 as a fallback made the
  // owner believe 1234 was the actual PIN even though the server kept the old/generated PIN.
  c = c.replace("value={c.passcode || '1234'}", "value={c.passcode || ''}");
  c = c.replace('placeholder="مثال: 1234"', 'placeholder="أدخل PIN جديد (4-8 أرقام)"');

  write(p, c);
}

// App: save the collector roster directly through the account-management Edge Function.
// Local state is updated only with the roster returned by the server, while preserving the PIN
// on the owner device so the owner can immediately see/use the credential just created.
{
  const p = 'src/App.tsx';
  let c = read(p);

  if (!c.includes("import { syncCloudCollectorRoster } from './lib/collectorCloud';")) {
    c = c.replace(
      "import { supabase } from './lib/supabase';",
      "import { supabase } from './lib/supabase';\nimport { syncCloudCollectorRoster } from './lib/collectorCloud';"
    );
  }

  const marker = "  const handleOpenFolderModal = (folderKey: string) => setActiveSettingsFolderKey(folderKey);";
  if (!c.includes('const handleUpdateCollectors = async (newCollectors: Collector[])')) {
    const handler = `  const handleUpdateCollectors = async (newCollectors: Collector[]) => {\n    const normalizePhone = (value: string) => String(value || '').replace(/\\D/g, '');\n    const seenPhones = new Set<string>();\n    for (const collector of newCollectors) {\n      const phone = normalizePhone(collector.phone);\n      if (phone.length < 10) throw new Error('invalid_collector_phone');\n      if (seenPhones.has(phone)) throw new Error('duplicate_collector_phone');\n      seenPhones.add(phone);\n      const pin = String(collector.passcode || '').trim();\n      if (pin && !/^\\d{4,8}$/.test(pin)) throw new Error('invalid_collector_pin');\n    }\n\n    const previous = collectors;\n\n    // Non-owner/local fallback remains local-only.\n    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {\n      setCollectors(newCollectors);\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n      return;\n    }\n\n    try {\n      const saved = await syncCloudCollectorRoster(newCollectors);\n      const pinByPhone = new Map(newCollectors.map(item => [normalizePhone(item.phone), String(item.passcode || '').trim()]));\n      const merged = saved.map(item => ({\n        ...item,\n        passcode: pinByPhone.get(normalizePhone(item.phone)) || '',\n      }));\n      setCollectors(merged);\n      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(merged));\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n      showToast('تم حفظ حسابات الجباة وربط تسجيل الدخول بنجاح');\n    } catch (error) {\n      setCollectors(previous);\n      try { localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(previous)); } catch (e) {}\n      throw error;\n    }\n  };\n\n`;
    if (!c.includes(marker)) throw new Error('handleOpenFolderModal marker not found');
    c = c.replace(marker, handler + marker);
  }

  const inline = `          onUpdateCollectors={(newCollectors) => {\n            setCollectors(newCollectors);\n            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n          }}`;
  c = c.replaceAll(inline, '          onUpdateCollectors={handleUpdateCollectors}');

  // Some builds format this callback slightly differently. Handle the compact variant too.
  c = c.replaceAll(
    `          onUpdateCollectors={(newCollectors) => {\n            setCollectors(newCollectors);\n            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));\n          }}`,
    '          onUpdateCollectors={handleUpdateCollectors}'
  );

  write(p, c);
}

console.log('Applied collector cloud-save, real PIN display, and login credential synchronization fix');

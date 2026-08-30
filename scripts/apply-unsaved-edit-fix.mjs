import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function patchFile(relativePath, patches) {
  const filePath = path.join(root, relativePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const patch of patches) {
    if (patch.skipIf && content.includes(patch.skipIf)) continue;
    if (!content.includes(patch.search)) {
      if (patch.optional) continue;
      throw new Error(`Patch pattern not found in ${relativePath}: ${patch.name}`);
    }
    content = content.replace(patch.search, patch.replace);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`patched ${relativePath}`);
  } else {
    console.log(`no changes needed ${relativePath}`);
  }
}

patchFile('src/components/FolderDetailModal.tsx', [
  {
    name: 'freeze folder detail modal form state while open',
    skipIf: 'لا نعيد تهيئتها مع تحديثات الخلفية كل 30 ثانية',
    search: `  useEffect(() => {\n    if (isOpen) {\n      setSpecs(generatorSpecs);\n      setCurrentLines(lines);\n      setCurrentCollectors(collectors);\n      setCurrentTemplate(invoiceTemplate);\n      setSaved(false);\n      setResetConfirm(false);\n      setAuditFilter('all');\n      setAuditSearch('');\n    }\n  }, [isOpen, generatorSpecs, lines, collectors, invoiceTemplate]);\n`,
    replace: `  // نهيئ الحقول فقط عند فتح النافذة أو تغيير نوع المجلد.\n  // لا نعيد تهيئتها مع تحديثات الخلفية كل 30 ثانية حتى لا تضيع تعديلات المستخدم قبل الحفظ.\n  useEffect(() => {\n    if (isOpen) {\n      setSpecs(generatorSpecs);\n      setCurrentLines(lines);\n      setCurrentCollectors(collectors);\n      setCurrentTemplate(invoiceTemplate);\n      setSaved(false);\n      setResetConfirm(false);\n      setAuditFilter('all');\n      setAuditSearch('');\n    }\n  }, [isOpen, folderKey]);\n`,
  },
  {
    name: 'mark folder detail as draft form',
    skipIf: 'data-moldatk-draft-form="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70',
    search: `<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">`,
    replace: `<div data-moldatk-draft-form="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">`,
  },
]);

patchFile('src/components/SubscriberModal.tsx', [
  {
    name: 'freeze subscriber modal form state while open',
    skipIf: 'لا نعتمد على تغيّر التسعيرة/الخطوط هنا',
    search: `  useEffect(() => {\n    if (subscriberToEdit) {\n      setFullName(subscriberToEdit.fullName || '');\n      setCode(subscriberToEdit.code || '');\n      setPhone(subscriberToEdit.phone || '');\n      setAmperes(subscriberToEdit.amperes || 5);\n      setTier(subscriberToEdit.tier || pricingTiers[0]?.id || 'standard');\n      setLine(subscriberToEdit.lineName || lines[0]?.name || '');\n      setCustomAmount(subscriberToEdit.amountDue?.toString() || '0');\n      setIsEditing(false);\n    } else {\n      setFullName('');\n      setCode(\`MW-\${Math.floor(1000 + Math.random() * 9000)}\`);\n      setPhone('');\n      setAmperes(5);\n      setTier(pricingTiers[0]?.id || 'standard');\n      setLine(lines[0]?.name || '');\n      setCustomAmount('0');\n      setIsEditing(true);\n    }\n    setActiveTab('details');\n    setIsConfirmDeleteOpen(false);\n    setIsConfirmUnpaidOpen(false);\n    setIsAdvancedOpen(false);\n  }, [subscriberToEdit, isOpen, pricingTiers, lines]);\n`,
    replace: `  // نملأ النموذج فقط عند فتح النافذة أو تبديل المشترك نفسه.\n  // لا نعتمد على تغيّر التسعيرة/الخطوط هنا لأن تحديثات الخلفية ممكن تعيد ملء الحقول وتلغي الكتابة قبل الحفظ.\n  useEffect(() => {\n    if (!isOpen) return;\n\n    if (subscriberToEdit) {\n      setFullName(subscriberToEdit.fullName || '');\n      setCode(subscriberToEdit.code || '');\n      setPhone(subscriberToEdit.phone || '');\n      setAmperes(subscriberToEdit.amperes || 5);\n      setTier(subscriberToEdit.tier || pricingTiers[0]?.id || 'standard');\n      setLine(subscriberToEdit.lineName || lines[0]?.name || '');\n      setCustomAmount(subscriberToEdit.amountDue?.toString() || '0');\n      setIsEditing(false);\n    } else {\n      setFullName('');\n      setCode(\`MW-\${Math.floor(1000 + Math.random() * 9000)}\`);\n      setPhone('');\n      setAmperes(5);\n      setTier(pricingTiers[0]?.id || 'standard');\n      setLine(lines[0]?.name || '');\n      setCustomAmount('0');\n      setIsEditing(true);\n    }\n    setActiveTab('details');\n    setIsConfirmDeleteOpen(false);\n    setIsConfirmUnpaidOpen(false);\n    setIsAdvancedOpen(false);\n  }, [isOpen, subscriberToEdit?.id]);\n`,
  },
  {
    name: 'mark subscriber modal as draft form',
    skipIf: 'data-moldatk-draft-form="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70',
    search: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">`,
    replace: `<div data-moldatk-draft-form="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">`,
  },
]);

patchFile('src/App.tsx', [
  {
    name: 'add draft form detector',
    skipIf: 'function hasOpenDraftForm()',
    search: `function useIsMobileViewport() {\n`,
    replace: `function hasOpenDraftForm() {\n  return typeof document !== 'undefined' && !!document.querySelector('[data-moldatk-draft-form="true"]');\n}\n\nfunction useIsMobileViewport() {\n`,
  },
  {
    name: 'prevent local sync refresh while draft modal is open',
    skipIf: 'إذا المستخدم فاتح نافذة تعديل، لا نعيد تحميل البيانات فوق حقوله غير المحفوظة',
    search: `    const refreshScopedData = () => {\n      setSubscribers(readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession));\n      setCollectors(readLocalJson<Collector[]>('moldatk_collectors', [], userSession));\n      setLines(readLocalJson<LineDistribution[]>('moldatk_lines', [], userSession));\n      setMonthlyTariffs(readLocalJson<MonthlyTariffRecord[]>('moldatk_monthly_tariffs', INITIAL_MONTHLY_TARIFFS, userSession));\n      setAuditLogs(readLocalJson<AuditLogEntry[]>('moldatk_audit_logs', [], userSession));\n      setGeneratorSpecs(readGeneratorSpecsForSession(userSession));\n      try {\n        setWalletResetTimestamp(localStorage.getItem(getStorageKey('moldatk_wallet_reset_timestamp', userSession)) || '');\n      } catch (e) {\n        setWalletResetTimestamp('');\n      }\n    };\n`,
    replace: `    const refreshScopedData = () => {\n      // إذا المستخدم فاتح نافذة تعديل، لا نعيد تحميل البيانات فوق حقوله غير المحفوظة.\n      if (hasOpenDraftForm()) return;\n\n      setSubscribers(readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession));\n      setCollectors(readLocalJson<Collector[]>('moldatk_collectors', [], userSession));\n      setLines(readLocalJson<LineDistribution[]>('moldatk_lines', [], userSession));\n      setMonthlyTariffs(readLocalJson<MonthlyTariffRecord[]>('moldatk_monthly_tariffs', INITIAL_MONTHLY_TARIFFS, userSession));\n      setAuditLogs(readLocalJson<AuditLogEntry[]>('moldatk_audit_logs', [], userSession));\n      setGeneratorSpecs(readGeneratorSpecsForSession(userSession));\n      try {\n        setWalletResetTimestamp(localStorage.getItem(getStorageKey('moldatk_wallet_reset_timestamp', userSession)) || '');\n      } catch (e) {\n        setWalletResetTimestamp('');\n      }\n    };\n`,
  },
  {
    name: 'prevent subscription poll from resetting generator specs draft',
    skipIf: 'if (!hasOpenDraftForm()) {\n            setGeneratorSpecs(prev => {',
    search: `          setGeneratorSpecs(prev => {\n            const updated = {\n              ...prev,\n              generatorName: serverGeneratorName,\n              ownerName: serverOwnerName,\n              location: g.data.area || prev.location,\n            };\n\n            try {\n              localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(updated));\n              rememberGeneratorAccount(userSession, updated);\n\n              const rawInvoiceSettings = localStorage.getItem(getStorageKey('moldatk_invoice_custom_settings'));\n              if (rawInvoiceSettings) {\n                const parsedInvoiceSettings = JSON.parse(rawInvoiceSettings);\n                localStorage.setItem(\n                  getStorageKey('moldatk_invoice_custom_settings'),\n                  JSON.stringify({ ...parsedInvoiceSettings, headerTitle: serverGeneratorName })\n                );\n              }\n            } catch (e) {}\n\n            return updated;\n          });\n`,
    replace: `          if (!hasOpenDraftForm()) {\n            setGeneratorSpecs(prev => {\n              const updated = {\n                ...prev,\n                generatorName: serverGeneratorName,\n                ownerName: serverOwnerName,\n                location: g.data.area || prev.location,\n              };\n\n              try {\n                localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(updated));\n                rememberGeneratorAccount(userSession, updated);\n\n                const rawInvoiceSettings = localStorage.getItem(getStorageKey('moldatk_invoice_custom_settings'));\n                if (rawInvoiceSettings) {\n                  const parsedInvoiceSettings = JSON.parse(rawInvoiceSettings);\n                  localStorage.setItem(\n                    getStorageKey('moldatk_invoice_custom_settings'),\n                    JSON.stringify({ ...parsedInvoiceSettings, headerTitle: serverGeneratorName })\n                  );\n                }\n              } catch (e) {}\n\n              return updated;\n            });\n          }\n`,
  },
]);

console.log('Unsaved edit protection patch applied.');

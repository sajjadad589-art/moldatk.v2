import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Record owner-side deletions before local removal so cloud sync cannot restore them.
{
  const p = 'src/App.tsx';
  let c = read(p);
  const plainDelete = `            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;\n            });`;
  const fixedDelete = `            try {\n              const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');\n              const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];\n              if (!deleted.includes(subId)) localStorage.setItem(tombstoneKey, JSON.stringify([...deleted, subId]));\n            } catch (e) {}\n            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;\n            });`;
  c = c.replaceAll(plainDelete, fixedDelete);

  const modalDelete = `            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              return updated;\n            });\n            setIsSubscriberModalOpen(false);`;
  const fixedModalDelete = `            try {\n              const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');\n              const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];\n              if (!deleted.includes(subId)) localStorage.setItem(tombstoneKey, JSON.stringify([...deleted, subId]));\n            } catch (e) {}\n            setSubscribers(prev => {\n              const updated = prev.filter(s => s.id !== subId);\n              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;\n            });\n            setIsSubscriberModalOpen(false);`;
  c = c.replaceAll(modalDelete, fixedModalDelete);
  write(p, c);
}

// Cloud deletion tombstones: delete remote rows first and filter pending deletions from pull results.
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = read(p);
  if (!c.includes("deletedSubscribers: key('moldatk_deleted_subscribers', generatorId)")) {
    c = c.replace("      audit: key('moldatk_audit_logs', generatorId),", "      audit: key('moldatk_audit_logs', generatorId),\n      deletedSubscribers: key('moldatk_deleted_subscribers', generatorId),");
  }
  if (!c.includes("deletedSubscribers: readLocal<string[]>(localKeys.deletedSubscribers, [])")) {
    c = c.replace("      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),", "      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),\n      deletedSubscribers: readLocal<string[]>(localKeys.deletedSubscribers, []),");
  }
  if (!c.includes('const deletedSubscribers = readLocal<string[]>(localKeys.deletedSubscribers, []);')) {
    c = c.replace("        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);", "        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const deletedSubscribers = readLocal<string[]>(localKeys.deletedSubscribers, []);\n        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);\n\n        if (deletedSubscribers.length) {\n          const { error: invoiceDeleteError } = await supabase.from('generator_invoices').delete().eq('generator_id', generatorId).in('subscriber_id', deletedSubscribers);\n          if (invoiceDeleteError) throw invoiceDeleteError;\n          const { error: subscriberDeleteError } = await supabase.from('generator_subscribers').delete().eq('generator_id', generatorId).in('id', deletedSubscribers);\n          if (subscriberDeleteError) throw subscriberDeleteError;\n          writeLocal(localKeys.deletedSubscribers, []);\n        }");
  }
  if (!c.includes('const deletedSubscriberIds = new Set(readLocal<string[]>(localKeys.deletedSubscribers, []));')) {
    c = c.replace("        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);", "        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const deletedSubscriberIds = new Set(readLocal<string[]>(localKeys.deletedSubscribers, []));");
  }
  c = c.replace("        writeLocal(localKeys.subscribers, (subs.data || []).map((row: any) => {", "        writeLocal(localKeys.subscribers, (subs.data || []).filter((row: any) => !deletedSubscriberIds.has(row.id)).map((row: any) => {");
  write(p, c);
}

// Compact connection state beside generator name. Old badges stay in DOM but hidden to avoid layout overlays.
{
  const p = 'src/components/POSQuickView.tsx';
  let c = read(p);
  const oldTitle = `<div className="text-center truncate px-1">\n            <h1 className="text-base sm:text-xl font-black text-amber-400 truncate">{generatorSpecs.generatorName || 'مولدتك'}</h1>\n          </div>`;
  const newTitle = `<div className="flex items-center justify-center gap-1.5 min-w-0 px-1">\n            <h1 className="text-base sm:text-xl font-black text-amber-400 truncate">{generatorSpecs.generatorName || 'مولدتك'}</h1>\n            <span className={\`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap \${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'}\`}>\n              <span className={\`w-1.5 h-1.5 rounded-full \${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}\`} />\n              <span>{isOnline ? 'متصل' : 'غير متصل'}</span>\n            </span>\n          </div>`;
  if (!c.includes('text-[8px] font-bold whitespace-nowrap')) c = c.replace(oldTitle, newTitle);
  c = c.replace('className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${', 'className={`hidden items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${');
  c = c.replace('className={`sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${', 'className={`hidden items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${');
  write(p, c);
}

console.log('Applied subscriber deletion persistence and safe compact collector online badge fixes.');

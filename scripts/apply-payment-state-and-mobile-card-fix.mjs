import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Payment/subscriber save must update the UI/local state immediately, then sync cloud.
{
  const p = 'src/App.tsx';
  let c = read(p);
  const start = c.indexOf('  const handleSaveSubscriber = async (newSub: Subscriber) => {');
  const end = start >= 0 ? c.indexOf('\n\n  const addAuditLog =', start) : -1;

  if (start < 0 || end < 0) {
    throw new Error('Could not locate handleSaveSubscriber for local-first payment fix');
  }

  const replacement = `  const handleSaveSubscriber = async (newSub: Subscriber) => {\n    const matchedTier = pricingTiers.find(t => t.id === newSub.tier || t.type === newSub.tier);\n    const matchedLine = lines.find(l => l.id === newSub.lineId || l.name === newSub.lineName || l.name === newSub.line);\n    const rawTier = String(newSub.tier || 'normal').replace(/^tier-/, '');\n    const normalizedTier = (matchedTier?.type || (['normal', 'commercial', 'golden', 'free', 'custom'].includes(rawTier) ? rawTier : 'normal')) as Subscriber['tier'];\n    const normalizedSub: Subscriber = {\n      ...newSub,\n      code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(subscribers),\n      subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(subscribers),\n      tier: normalizedTier,\n      lineId: matchedLine?.id || newSub.lineId,\n      line: matchedLine?.name || newSub.line || newSub.lineName,\n      lineName: matchedLine?.name || newSub.lineName || newSub.line,\n    };\n\n    // Local-first: payment/status changes become visible immediately and never wait for network.\n    setSubscribers(prev => {\n      const exists = prev.some(s => s.id === normalizedSub.id);\n      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];\n      try {\n        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}\n      return updated;\n    });\n    setSubscriberToEdit(normalizedSub);\n\n    const shouldSyncCloud = (userSession?.role === 'generator_admin' || userSession?.role === 'collector') && Boolean(userSession.generatorId);\n    const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;\n    let cloudSynced = false;\n\n    if (shouldSyncCloud && onlineNow && userSession?.generatorId) {\n      try {\n        await persistCollectorSubscriber(userSession.generatorId, normalizedSub);\n        cloudSynced = true;\n      } catch (error: any) {\n        console.error('Subscriber cloud save deferred:', error);\n      }\n    }\n\n    if (shouldSyncCloud && !cloudSynced) {\n      try {\n        window.dispatchEvent(new CustomEvent('moldatk-sync-progress', { detail: { active: false, progress: 0, pending: true, message: 'محفوظ محلياً — بانتظار المزامنة' } }));\n      } catch (e) {}\n      showToast(onlineNow ? 'تم الحفظ محلياً وستتم إعادة المزامنة تلقائياً' : 'تم الحفظ بدون إنترنت وسيتم رفعه عند رجوع الاتصال');\n    } else {\n      showToast('تم حفظ بيانات المشترك ومزامنتها بنجاح');\n    }\n  };`;

  c = c.slice(0, start) + replacement + c.slice(end);
  write(p, c);
  console.log('Applied local-first subscriber payment state persistence');
}

// 2) Owner mobile subscriber card: name, amperes and amount at same visual level; no delete button on card.
{
  const p = 'src/components/mobile/MobileSubscribers.tsx';
  let c = read(p);

  const headerStart = c.indexOf('                {/* Header Row: Name & Phone & Tier Badge */}');
  const partialMarker = '                {/* If partial, show quick stats */}';
  const headerEnd = headerStart >= 0 ? c.indexOf(partialMarker, headerStart) : -1;
  if (headerStart >= 0 && headerEnd > headerStart) {
    const fresh = `                {/* Compact primary row: name / amperes / amount */}\n                <div className={\`grid grid-cols-[1.3fr_0.7fr_1fr] items-center gap-2 p-2.5 rounded-2xl \${styles.innerSubBox}\`}>\n                  <div className="min-w-0 text-right">\n                    <span className="text-[9px] font-bold text-slate-400 block">اسم المشترك</span>\n                    <span className={\`text-base font-black truncate block leading-tight \${styles.nameText}\`}>{sub.fullName}</span>\n                  </div>\n                  <div className="text-center">\n                    <span className="text-[9px] font-bold text-slate-400 block">الأمبير</span>\n                    <span className="text-base font-black text-blue-500 tabular-nums">{formatNumberArabic(sub.amperes)} A</span>\n                  </div>\n                  <div className="text-center min-w-0">\n                    <span className="text-[9px] font-bold text-slate-400 block">{isPartial ? 'المتبقي' : 'المبلغ'}</span>\n                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums truncate block">\n                      {isFree ? 'إعفاء' : isPartial ? formatCurrency(Math.max(0, sub.amountDue - (sub.amountPaid || 0))) : formatCurrency(sub.amountDue)}\n                    </span>\n                  </div>\n                </div>\n\n                <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[9px] text-slate-400">\n                  <span className="truncate">{sub.phone || sub.code}</span>\n                  <span className={\`shrink-0 px-2 py-0.5 rounded-lg font-bold \${styles.badgeBg}\`}>{tierData?.nameAr || sub.tier}</span>\n                </div>\n\n`;
    c = c.slice(0, headerStart) + fresh + c.slice(headerEnd);
  } else {
    console.log('Mobile subscriber primary info block already transformed or marker missing');
  }

  // Remove the visible delete button from the list card only.
  const deleteStartNeedle = `                  <button\n                    onClick={(e) => {\n                      e.stopPropagation();\n                      if (window.confirm(\`هل تريد حذف المشترك \${sub.fullName}؟ لا يمكن التراجع عن هذه العملية.\`)) {`;
  const deleteStart = c.indexOf(deleteStartNeedle);
  if (deleteStart >= 0) {
    const deleteEndMarker = '                  </button>\n\n                  {/* Open details prompt */}';
    const deleteEnd = c.indexOf(deleteEndMarker, deleteStart);
    if (deleteEnd > deleteStart) {
      c = c.slice(0, deleteStart) + '                  {/* Delete moved to edit-subscriber screen */}\n\n                  {/* Open details prompt */}' + c.slice(deleteEnd + deleteEndMarker.length);
    }
  }

  write(p, c);
  console.log('Applied compact mobile subscriber card and removed list delete action');
}

// 3) Delete is shown only at the bottom of edit mode in SubscriberModal.
{
  const p = 'src/components/SubscriberModal.tsx';
  let c = read(p);
  const oldBlock = `            {isEditing && (\n              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">\n                <button\n                  type="button"\n                  onClick={() => setIsConfirmDeleteOpen(true)}\n                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"\n                >\n                  <Trash2 className="w-4 h-4" />\n                  <span>حذف المشترك</span>\n                </button>\n\n                <div className="flex items-center gap-3">\n                  <button\n                    type="button"\n                    onClick={() => setIsEditing(false)}\n                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"\n                  >\n                    إغلاق\n                  </button>\n                  <button\n                    type="submit"\n                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer"\n                  >\n                    حفظ التعديلات\n                  </button>\n                </div>\n              </div>\n            )}`;

  const newBlock = `            {isEditing && (\n              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">\n                <div className="flex items-center justify-end gap-3">\n                  <button\n                    type="button"\n                    onClick={() => setIsEditing(false)}\n                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"\n                  >\n                    إغلاق\n                  </button>\n                  <button\n                    type="submit"\n                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer"\n                  >\n                    حفظ التعديلات\n                  </button>\n                </div>\n\n                {subscriberToEdit && (\n                  <button\n                    type="button"\n                    onClick={() => setIsConfirmDeleteOpen(true)}\n                    className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 text-xs font-black cursor-pointer"\n                  >\n                    <Trash2 className="w-4 h-4" />\n                    <span>حذف المشترك</span>\n                  </button>\n                )}\n              </div>\n            )}`;

  if (c.includes(oldBlock)) c = c.replace(oldBlock, newBlock);
  write(p, c);
  console.log('Moved subscriber delete action to bottom of edit mode');
}

console.log('Applied payment state + owner mobile subscriber UX fix v1');

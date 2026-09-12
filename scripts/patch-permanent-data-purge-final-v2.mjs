import fs from 'node:fs';

const path = 'scripts/apply-permanent-data-purge-final.mjs';
let source = fs.readFileSync(path, 'utf8');

const legacy = `    const insertion = source.indexOf('  const handleSaveSubscriber = (newSub: Subscriber) => {');\n    must(insertion >= 0, 'handleSaveSubscriber insertion point missing');\n    source = source.slice(0, insertion) + permanentSubscriberDelete + source.slice(insertion);`;
const hardened = `    let insertion = source.indexOf('  const handleSaveSubscriber = (newSub: Subscriber) => {');\n    if (insertion < 0) insertion = source.indexOf('  const addAuditLog = (entry: any) => {');\n    if (insertion < 0) insertion = source.indexOf('  if (!userSession) {');\n    must(insertion >= 0, 'subscriber delete handler insertion point missing');\n    source = source.slice(0, insertion) + permanentSubscriberDelete + source.slice(insertion);`;

if (source.includes(legacy)) {
  source = source.replace(legacy, hardened);
  fs.writeFileSync(path, source, 'utf8');
}

const final = fs.readFileSync(path, 'utf8');
if (!final.includes("subscriber delete handler insertion point missing")) {
  throw new Error('Permanent purge finalizer insertion hardening missing');
}

await import('./apply-permanent-data-purge-final.mjs');

// Extend the already server-authoritative purge with the remaining generator-scoped
// operational rows that are not part of the original generator-data-admin function.
const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

const resetNeedle = `      const { data: resetData, error: resetError } = await supabase.functions.invoke('generator-data-admin', {\n        body: { action: 'reset_generator_data' },\n      });`;
if (!app.includes("action: 'reset_extras'")) {
  if (!app.includes(resetNeedle)) throw new Error('Permanent purge runtime patch: reset server call missing');
  app = app.replace(resetNeedle, `      const { data: extraResetData, error: extraResetError } = await supabase.functions.invoke('generator-data-cleanup', {\n        body: { action: 'reset_extras' },\n      });\n      if (extraResetError || !extraResetData?.ok) {\n        throw new Error(extraResetData?.error || extraResetError?.message || 'تعذر تنظيف البيانات التشغيلية الإضافية');\n      }\n\n${resetNeedle}`);
}

const subscriberCoreSuccess = `    if (error || !data?.ok) {\n      showToast('تعذر حذف المشترك نهائياً: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n      return;\n    }`;
if (!app.includes("action: 'delete_subscriber_extras'")) {
  if (!app.includes(subscriberCoreSuccess)) throw new Error('Permanent purge runtime patch: subscriber server success guard missing');
  app = app.replace(subscriberCoreSuccess, `${subscriberCoreSuccess}\n\n    const { data: extraDeleteData, error: extraDeleteError } = await supabase.functions.invoke('generator-data-cleanup', {\n      body: { action: 'delete_subscriber_extras', subscriber_id: subId },\n    });\n    if (extraDeleteError || !extraDeleteData?.ok) {\n      showToast('تم حذف البيانات المالية للمشترك لكن تعذر تنظيف سجلات AI المرتبطة. أعد المحاولة لإكمال الحذف.');\n      return;\n    }`);
}

if (!app.includes("supabase.functions.invoke('generator-data-cleanup'")) throw new Error('Permanent purge runtime patch: cleanup Edge Function not wired');
if (!app.includes("action: 'reset_extras'")) throw new Error('Permanent purge runtime patch: reset extras action missing');
if (!app.includes("action: 'delete_subscriber_extras'")) throw new Error('Permanent purge runtime patch: subscriber extras action missing');

fs.writeFileSync(appPath, app, 'utf8');

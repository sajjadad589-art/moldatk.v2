import fs from 'node:fs';

const file = 'src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

const oldImport = "import { loadSubscribers, upsertSubscriber, deleteSubscriber, subscribeToGeneratorChanges } from './lib/sharedData';";
const newImport = "import { loadSubscribers, upsertSubscriber, deleteSubscriber, loadInvoices, upsertInvoice, subscribeToGeneratorChanges } from './lib/sharedData';";
if (src.includes(oldImport)) src = src.replace(oldImport, newImport);

// Allow both generator admin and authenticated collector sessions to use the shared cloud data.
src = src.replace(
  "if (userSession?.role !== 'generator_admin' || !userSession.generatorId) return;",
  "if (!userSession?.generatorId || (userSession.role !== 'generator_admin' && userSession.role !== 'collector')) return;"
);

const oldLoad = `        const cloudSubscribers = await loadSubscribers(generatorId);\n        if (disposed) return;\n\n        const localSubscribers = readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession);`;
const newLoad = `        const [cloudSubscribersRaw, cloudInvoices] = await Promise.all([\n          loadSubscribers(generatorId),\n          loadInvoices(generatorId),\n        ]);\n        if (disposed) return;\n\n        const invoicesBySubscriber = new Map<string, SubscriberInvoice[]>();\n        for (const invoice of cloudInvoices) {\n          const list = invoicesBySubscriber.get(invoice.subscriberId) || [];\n          list.push(invoice);\n          invoicesBySubscriber.set(invoice.subscriberId, list);\n        }\n        const cloudSubscribers = cloudSubscribersRaw.map(sub => ({\n          ...sub,\n          invoicesHistory: invoicesBySubscriber.get(sub.id) || [],\n        }));\n\n        const localSubscribers = readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession);`;
if (src.includes(oldLoad)) src = src.replace(oldLoad, newLoad);

const oldMigrationUpload = `          await Promise.all(localSubscribers.map(sub => upsertSubscriber(generatorId, sub)));`;
const newMigrationUpload = `          await Promise.all(localSubscribers.map(async sub => {\n            await upsertSubscriber(generatorId, sub);\n            if (sub.invoicesHistory?.length) {\n              await Promise.all(sub.invoicesHistory.map(inv => upsertInvoice(generatorId, inv)));\n            }\n          }));`;
if (src.includes(oldMigrationUpload)) src = src.replace(oldMigrationUpload, newMigrationUpload);

const oldCloudSave = `    if (userSession?.role === 'generator_admin' && userSession.generatorId) {\n      void upsertSubscriber(userSession.generatorId, normalizedSub).catch(error => {\n        console.error('Failed to save subscriber to Supabase:', error);\n        showToast('تم الحفظ على الجهاز، وتعذرت المزامنة. ستتم المحاولة عند رجوع الإنترنت.');\n      });\n    }`;
const newCloudSave = `    if (userSession?.generatorId && (userSession.role === 'generator_admin' || userSession.role === 'collector')) {\n      const generatorId = userSession.generatorId;\n      void (async () => {\n        await upsertSubscriber(generatorId, normalizedSub);\n        if (normalizedSub.invoicesHistory?.length) {\n          await Promise.all(normalizedSub.invoicesHistory.map(inv => upsertInvoice(generatorId, inv)));\n        }\n      })().catch(error => {\n        console.error('Failed to save subscriber/invoices to Supabase:', error);\n        showToast('تم الحفظ على الجهاز، وتعذرت المزامنة. ستتم المحاولة عند رجوع الإنترنت.');\n      });\n    }`;
if (src.includes(oldCloudSave)) src = src.replace(oldCloudSave, newCloudSave);

const oldCloudDelete = `    if (userSession?.role === 'generator_admin' && userSession.generatorId) {\n      void deleteSubscriber(userSession.generatorId, subId).catch(error => {`;
const newCloudDelete = `    if (userSession?.generatorId && (userSession.role === 'generator_admin' || userSession.role === 'collector')) {\n      void deleteSubscriber(userSession.generatorId, subId).catch(error => {`;
if (src.includes(oldCloudDelete)) src = src.replace(oldCloudDelete, newCloudDelete);

fs.writeFileSync(file, src);
console.log('Shared invoice/payment cloud sync applied');

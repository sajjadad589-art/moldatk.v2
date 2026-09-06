import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

// Keep one seasonal/moments manager only. AdminAdSlidesPanel already contains
// the richer SeasonalCampaignsPanel, so the separate SeasonalCampaignManager
// created a duplicate card in the notifications page.
src = src.replace(/\nimport \{ SeasonalCampaignManager \} from '\.\/SeasonalCampaignManager';/g, '');
src = src.replace(/\n\s*<SeasonalCampaignManager \/>\s*/g, '\n');

// Make the notifications page responsive and ordered: campaign + ads full-width,
// then notification composer and history side-by-side on wide screens.
src = src.replace(
  'grid grid-cols-[420px_1fr] gap-5',
  'grid grid-cols-1 xl:grid-cols-2 gap-5 items-start'
);
if (src.includes('<AdminAdSlidesPanel />') && !src.includes('SUPER_ADMIN_NOTIFICATIONS_LAYOUT_V2')) {
  src = src.replace(
    '<AdminAdSlidesPanel />',
    '<div className="xl:col-span-2" data-layout="SUPER_ADMIN_NOTIFICATIONS_LAYOUT_V2"><AdminAdSlidesPanel /></div>'
  );
}

// Owner-only destructive account deletion from the generator details modal.
if (!src.includes('const deleteGeneratorAccount = async () =>')) {
  const marker = '  const openEditSubscription = () => {';
  if (!src.includes(marker)) throw new Error('Super Admin openEditSubscription marker not found');
  const handler = `  const deleteGeneratorAccount = async () => {\n    if (!selectedGeneratorId || !selectedGenerator) return;\n\n    const firstConfirm = window.confirm(\n      \`تحذير: سيتم حذف حساب \"\${selectedGenerator.name}\" نهائياً مع المشتركين والديون والتسديدات والتسعيرات والجباة المرتبطين به. لا يمكن التراجع عن العملية. هل تريد المتابعة؟\`\n    );\n    if (!firstConfirm) return;\n\n    const typedName = window.prompt(\n      \`للتأكيد النهائي اكتب اسم المولدة كما هو بالضبط:\\n\${selectedGenerator.name}\`\n    );\n    if (typedName === null) return;\n    if (typedName.trim() !== selectedGenerator.name.trim()) {\n      setMessage('تم إلغاء الحذف لأن اسم المولدة المكتوب غير مطابق.');\n      return;\n    }\n\n    setSavingAccount(true);\n    setMessage(null);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: {\n        action: 'delete_account',\n        generator_id: selectedGeneratorId,\n        confirmation_name: typedName.trim(),\n      },\n    });\n    setSavingAccount(false);\n\n    if (error || !data?.ok) {\n      setMessage(\`تعذر حذف الحساب: \${data?.error || error?.message || 'خطأ غير معروف'}\`);\n      return;\n    }\n\n    setSelectedGeneratorId(null);\n    setRenewalOpen(false);\n    setCredentialsOpen(false);\n    setEditSubscriptionOpen(false);\n    setMessage('تم حذف حساب صاحب المولدة وجميع بياناته التشغيلية المرتبطة بنجاح.');\n    await load();\n  };\n\n`;
  src = src.replace(marker, handler + marker);
}

if (!src.includes('onClick={() => void deleteGeneratorAccount()}')) {
  const statusButtonRegex = /(\s*<button disabled=\{savingAccount\} onClick=\{\(\) => void setGeneratorStatus\([\s\S]*?<\/button>)/;
  const match = src.match(statusButtonRegex);
  if (!match) throw new Error('Generator status button not found for delete-account placement');
  const statusButton = match[1].trim();
  const controls = `\n            <div className="flex items-center gap-2 flex-wrap">\n              ${statusButton}\n              <button disabled={savingAccount} onClick={() => void deleteGeneratorAccount()} className="px-4 py-2.5 rounded-xl font-black inline-flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="w-4 h-4" />حذف الحساب</button>\n            </div>`;
  src = src.replace(match[1], controls);
}

// Final invariants for this patch.
const seasonalManagerUsage = (src.match(/<SeasonalCampaignManager \/>/g) || []).length;
if (seasonalManagerUsage !== 0) throw new Error('Duplicate standalone seasonal manager remains');
if (!src.includes('SUPER_ADMIN_NOTIFICATIONS_LAYOUT_V2')) throw new Error('Notifications responsive layout marker missing');
if (!src.includes('const deleteGeneratorAccount = async () =>')) throw new Error('Generator delete handler missing');
if (!src.includes('onClick={() => void deleteGeneratorAccount()}')) throw new Error('Generator delete button missing');
if (!src.includes("action: 'delete_account'")) throw new Error('Generator delete edge action missing from UI');

fs.writeFileSync(path, src, 'utf8');
console.log('Super Admin notifications deduplicated/reordered and protected generator delete action added.');

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
      if (patch.optional) {
        console.warn(`optional patch skipped in ${relativePath}: ${patch.name}`);
        continue;
      }
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

patchFile('src/components/SettingsFolderView.tsx', [
  {
    name: 'open modern lines and boards modal',
    skipIf: "onClick={() => onOpenFolderModal('lines_zones')}",
    search: `        {/* بطاقة الكابينات والبوردات */}\n        <div\n          onClick={() => setIsModalOpen(true)}\n          className="bg-white dark:bg-[#131E38] border border-blue-500/80 hover:border-blue-500 rounded-3xl p-5 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 group"\n        >`,
    replace: `        {/* بطاقة الكابينات والبوردات */}\n        <div\n          onClick={() => onOpenFolderModal('lines_zones')}\n          className="bg-white dark:bg-[#131E38] border border-blue-500/80 hover:border-blue-500 rounded-3xl p-5 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 group"\n        >`,
  },
  {
    name: 'activate generator specs card open',
    skipIf: "onClick={() => onOpenFolderModal('generator_specs')}",
    search: `        {/* بيانات المولد (قريباً) */}\n        <div\n          onClick={() => alert('هذه الخاصية قيد التطوير وستتوفر قريباً!')}\n          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group opacity-90"\n        >`,
    replace: `        {/* بيانات المولد وقدرة المحولة */}\n        <div\n          onClick={() => onOpenFolderModal('generator_specs')}\n          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"\n        >`,
  },
  {
    name: 'generator specs badge active',
    skipIf: `<span className="px-3 py-1 rounded-full text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">\n              فعال\n            </span>`,
    search: `<span className="px-3 py-1 rounded-full text-[10px] font-black border bg-amber-500/10 text-amber-400 border-amber-500/30">\n              قريباً...\n            </span>`,
    replace: `<span className="px-3 py-1 rounded-full text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">\n              فعال\n            </span>`,
  },
  {
    name: 'generator specs card description',
    skipIf: 'تعديل قدرة KVA، الأمبير، بيانات المحرك، الوقود، المالك وموقع المولدة',
    search: `<p className="text-xs text-slate-400 font-medium">قيد التطوير والتحديث</p>`,
    replace: `<p className="text-xs text-slate-400 font-medium">تعديل قدرة KVA، الأمبير، بيانات المحرك، الوقود، المالك وموقع المولدة</p>`,
  },
  {
    name: 'generator specs footer active',
    skipIf: `<div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">\n            <span>فتح إعدادات المولد</span>`,
    search: `<div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-slate-400">\n            <span>ستتوفر قريباً</span>\n            <Folder className="w-4 h-4 opacity-50" />\n          </div>`,
    replace: `<div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">\n            <span>فتح إعدادات المولد</span>\n            <Folder className="w-4 h-4" />\n          </div>`,
  },
  {
    name: 'make legacy add line object complete',
    skipIf: "phaseType: 'phase-R',\n        phaseNameAr: 'فيز R (الأحمر) - 380V',",
    search: `    const newName = textInputVal.trim();\n    const newList = [\n      ...linesData,\n      { id: \`line-\${Date.now()}\`, name: newName, loadAmps: 0, subscribersCount: 0 }\n    ];`,
    replace: `    const newName = textInputVal.trim();\n    const newList = [\n      ...linesData,\n      {\n        id: \`line-\${Date.now()}\`,\n        name: newName,\n        zone: 'المنطقة / الشارع',\n        phaseType: 'phase-R',\n        phaseNameAr: 'فيز R (الأحمر) - 380V',\n        maxCapacityAmperes: 200,\n        currentLoadAmperes: 0,\n        subscribersCount: 0,\n        technicianName: 'فني الصيانة المناوب',\n        breakerNumber: \`Q\${linesData.length + 1}-250A\`,\n      }\n    ];`,
  },
]);

console.log('Settings folder actions patch applied.');

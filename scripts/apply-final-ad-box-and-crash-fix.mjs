import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const ensureMobileSliderImport = (path) => {
  let src = read(path);
  if (!src) return;
  src = src.replace(/import \{ MobileAdSlider \} from '\.\/MobileAdSlider';\n/g, '');
  src = src.replace('import React', "import { MobileAdSlider } from './MobileAdSlider';\nimport React");
  src = src.replace(/\n\s*<MobileAdSlider className="[^"]*" \/>\n/g, '\n');
  write(path, src);
};

const dashboardPath = 'src/components/mobile/MobileDashboard.tsx';
ensureMobileSliderImport(dashboardPath);
let dashboard = read(dashboardPath);
const dashboardMarker = '      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}';
if (dashboard.includes(dashboardMarker) && !dashboard.includes('<MobileAdSlider className="mt-1" />')) {
  dashboard = dashboard.replace(dashboardMarker, '      <MobileAdSlider className="mt-1" />\n\n' + dashboardMarker);
}
write(dashboardPath, dashboard);

const reportsPath = 'src/components/mobile/MobileMonthlyReports.tsx';
ensureMobileSliderImport(reportsPath);
let reports = read(reportsPath);
const reportsMarker = '      <div className="grid grid-cols-2 gap-2.5">';
if (reports.includes(reportsMarker) && !reports.includes('<MobileAdSlider className="my-1" />')) {
  reports = reports.replace(reportsMarker, '      <MobileAdSlider className="my-1" />\n\n' + reportsMarker);
}
write(reportsPath, reports);

const sliderPath = 'src/components/mobile/MobileAdSlider.tsx';
let slider = read(sliderPath);
if (slider) {
  slider = slider.replace(/rounded-\[28px\]/g, 'rounded-[22px]');
  slider = slider.replace(/aspect-\[16\/6\]/g, 'aspect-[16/6.4]');
  slider = slider.replace(/aspect-\[16\/7\]/g, 'aspect-[16/6.4]');
  slider = slider.replace(/},\s*4000\)/g, '}, 3500)');
  slider = slider.replace(/},\s*3000\)/g, '}, 3500)');
  write(sliderPath, slider);
}

const settingsPath = 'src/components/mobile/MobileSettings.tsx';
write(settingsPath, String.raw`import React from 'react';
import { ChevronLeft, Database, DollarSign, Network, Printer, RotateCcw, Sliders, Users, Zap } from 'lucide-react';
import { DeviceViewMode, GeneratorSpecs, LineDistribution, SettingsFolderItem, SubscriptionTierPricing } from '../../types';
import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';

interface MobileSettingsProps {
  viewMode: DeviceViewMode;
  onChangeViewMode: (mode: DeviceViewMode) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  folders: SettingsFolderItem[];
  onOpenPricingModal: () => void;
  onOpenFolderModal: (folderKey: string) => void;
  onExportData: () => void;
  onResetData: () => void;
  subscriptionInfo?: SubscriptionInfo | null;
  subscriptionLoading?: boolean;
}

const folderIcon = (key: string) => {
  if (key.includes('subscriber')) return Users;
  if (key.includes('line')) return Network;
  if (key.includes('print')) return Printer;
  if (key.includes('backup') || key.includes('data')) return Database;
  if (key.includes('price') || key.includes('pricing')) return DollarSign;
  return Sliders;
};

const isHiddenFolder = (folder: SettingsFolderItem) => {
  const text = String(folder.key || '') + ' ' + String(folder.title || '') + ' ' + String(folder.description || '');
  return /theme|appearance|view mode|مظهر|ثيم|نمط العرض|التوافق/i.test(text);
};

export const MobileSettings: React.FC<MobileSettingsProps> = ({
  folders,
  onOpenPricingModal,
  onOpenFolderModal,
  onExportData,
  onResetData,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  const visibleFolders = (folders || []).filter(folder => !isHiddenFolder(folder));

  return (
    <div className="space-y-4 pb-24" dir="rtl">
      <section className="rounded-[24px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">الإعدادات</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">إدارة التسعيرات والبيانات والخيارات الأساسية</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4">
          <SubscriptionInfoButton subscriptionInfo={subscriptionInfo} loading={subscriptionLoading} />
        </div>
      </section>

      <section className="rounded-[24px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <button type="button" onClick={onOpenPricingModal} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-blue-600 text-white px-4 py-4 font-black shadow-sm">
          <span className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> التسعيرات الشهرية</span>
          <ChevronLeft className="w-5 h-5" />
        </button>
      </section>

      <section className="grid grid-cols-1 gap-3">
        {visibleFolders.map(folder => {
          const Icon = folderIcon(folder.key || 'settings');
          return (
            <button key={folder.key} type="button" onClick={() => onOpenFolderModal(folder.key)} className="w-full rounded-[22px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-4 py-4 shadow-sm flex items-center justify-between text-right">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white truncate">{folder.title}</h3>
                  {folder.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{folder.description}</p>}
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </section>

      <section className="rounded-[24px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <button type="button" onClick={onExportData} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-black text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2"><Database className="w-5 h-5" /> تصدير البيانات</span>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button type="button" onClick={onResetData} className="w-full rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-4 py-3 font-black text-red-700 dark:text-red-300 flex items-center justify-between">
          <span className="flex items-center gap-2"><RotateCcw className="w-5 h-5" /> تصفير بيانات الجهاز</span>
          <ChevronLeft className="w-5 h-5" />
        </button>
      </section>
    </div>
  );
};
`);

const finalDashboard = read(dashboardPath);
const finalReports = read(reportsPath);
const finalSlider = read(sliderPath);
const finalSettings = read(settingsPath);
if (!finalDashboard.includes('<MobileAdSlider className="mt-1" />')) throw new Error('Dashboard ad slider missing');
if (!finalReports.includes('<MobileAdSlider className="my-1" />')) throw new Error('Reports ad slider missing');
if (!finalSlider.includes('3500')) throw new Error('Mobile slider interval missing');
if (/المظهر والثيم|اختر اللون المريح|بحري هادئ|ذهبي فاتح|داكن رسمي|View Mode|نمط العرض والتوافق/.test(finalSettings)) {
  throw new Error('Old theme/view mode settings card still exists');
}
console.log('Final mobile ad slider and clean settings applied.');

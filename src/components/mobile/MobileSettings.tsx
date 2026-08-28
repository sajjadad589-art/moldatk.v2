import React from 'react';
import {
  DollarSign,
  Zap,
  Network,
  Database,
  Moon,
  Sun,
  Smartphone,
  Monitor,
  RotateCcw,
  Download,
  ChevronLeft,
  Shield,
  Sliders,
  Sparkles,
  Users,
  Printer,
} from 'lucide-react';
import {
  DeviceViewMode,
  SubscriptionTierPricing,
  GeneratorSpecs,
  LineDistribution,
  SettingsFolderItem,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
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

export const MobileSettings: React.FC<MobileSettingsProps> = ({
  viewMode,
  onChangeViewMode,
  darkMode,
  onToggleTheme,
  pricingTiers,
  generatorSpecs,
  lines,
  folders,
  onOpenPricingModal,
  onOpenFolderModal,
  onExportData,
  onResetData,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  const getFolderIcon = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-500" />;
      case 'Network':
        return <Network className="w-5 h-5 text-blue-500" />;
      case 'Users':
        return <Users className="w-5 h-5 text-purple-500" />;
      case 'Printer':
        return <Printer className="w-5 h-5 text-indigo-500" />;
      default:
        return <Database className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">
      {/* 1. Device View Mode Selector Card (الميزة المطلوبة بوضوح) */}
      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              نمط العرض والتوافق مع الأجهزة (View Mode)
            </h3>
            <p className="text-[10px] text-slate-400">
              اختر واجهة الهاتف المخصصة أو واجهة برنامج الحاسوب أو الكشف التلقائي
            </p>
          </div>
        </div>

        {/* 3-Way Segmented Control */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => onChangeViewMode('mobile')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'mobile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 mb-1" />
            <span>هاتف 📱</span>
          </button>

          <button
            onClick={() => onChangeViewMode('desktop')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'desktop'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 mb-1" />
            <span>حاسوب 🖥️</span>
          </button>

          <button
            onClick={() => onChangeViewMode('auto')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'auto'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4 mb-1" />
            <span>تلقائي 🔄</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          {viewMode === 'auto' && 'الوضع الحالي: كشف تلقائي (يتم فتح واجهة الهاتف عند الدخول من الموبايل وواجهة الحاسوب عند الدخول من الكمبيوتر).'}
          {viewMode === 'mobile' && 'الوضع الحالي: واجهة الهاتف مفعلة بشكل دائم ومخصصة لشاشات اللمس.'}
          {viewMode === 'desktop' && 'الوضع الحالي: واجهة الحاسوب مفعلة (اللوحة الجانبية والجداول الكاملة).'}
        </div>
      </div>

      {/* 2. Appearance & Theme Toggle (Dark / Light) */}
      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">المظهر (Dark / Light)</h3>
            <p className="text-[10px] text-slate-400">
              {darkMode ? 'الوضع الليلي (أزرق داكن احترافي)' : 'الوضع النهاري (فاتح وأنيق)'}
            </p>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
            darkMode ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              darkMode ? 'translate-x-0' : 'translate-x-6'
            }`}
          />
        </button>
      </div>

      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />

      {/* 3. Settings Folders (Full CRUD Access on Mobile) */}
      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                فروع وإعدادات المنظومة
              </h3>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {folders.map(f => (
            <div
              key={f.id}
              onClick={() => {
                if (f.folderKey === 'pricing') {
                  onOpenPricingModal();
                } else {
                  onOpenFolderModal(f.folderKey);
                }
              }}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {getFolderIcon(f.iconName)}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                    {f.titleAr}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {f.badge && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {f.badge}
                  </span>
                )}
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


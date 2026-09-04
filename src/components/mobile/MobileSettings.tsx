import React from 'react';
import {
  DollarSign,
  Zap,
  Network,
  Database,
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
  Image as ImageIcon,
  ExternalLink,
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
import { supabase } from '../../lib/supabase';

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

type AdminAdSlide = {
  id: string;
  title?: string | null;
  image_url: string;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  updated_at?: string | null;
};

export const MobileSettings: React.FC<MobileSettingsProps> = ({
  viewMode,
  onChangeViewMode,
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
  const [adminAd, setAdminAd] = React.useState<AdminAdSlide | null>(null);
  const [adLoading, setAdLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadAdminAd = async () => {
      try {
        const cached = localStorage.getItem('moldatk_single_admin_ad_slide');
        if (cached && !cancelled) setAdminAd(JSON.parse(cached));
      } catch (e) {}

      try {
        const { data, error } = await supabase
          .from('app_ad_slides')
          .select('id,title,image_url,link_url,sort_order,is_active,updated_at')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          localStorage.setItem('moldatk_single_admin_ad_slide', JSON.stringify(data));
          if (!cancelled) setAdminAd(data as AdminAdSlide);
        } else if (!error && !data) {
          localStorage.removeItem('moldatk_single_admin_ad_slide');
          if (!cancelled) setAdminAd(null);
        }
      } catch (e) {
        // Keep cached ad if offline.
      } finally {
        if (!cancelled) setAdLoading(false);
      }
    };

    void loadAdminAd();
    const timer = window.setInterval(() => void loadAdminAd(), 60000);
    window.addEventListener('moldatk-local-sync', loadAdminAd as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('moldatk-local-sync', loadAdminAd as EventListener);
    };
  }, []);

  const openAdminAd = () => {
    if (adminAd?.link_url) window.open(adminAd.link_url, '_blank', 'noopener,noreferrer');
  };

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
      {/* Independent single Supabase advertisement box */}
      <section className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">إعلان الإدارة</h3>
              <p className="text-[10px] text-slate-400">يتحدث تلقائياً عند الاتصال بالإنترنت</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-300">Supabase</span>
        </div>

        {adminAd?.image_url ? (
          <button
            type="button"
            onClick={openAdminAd}
            className={`block w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-right ${adminAd.link_url ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <img
              src={adminAd.image_url}
              alt={adminAd.title || 'إعلان الإدارة'}
              className="w-full aspect-[16/7] object-cover bg-slate-100 dark:bg-slate-900"
              loading="lazy"
            />
            {(adminAd.title || adminAd.link_url) && (
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                  {adminAd.title || 'إعلان الإدارة'}
                </span>
                {adminAd.link_url && <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />}
              </div>
            )}
          </button>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                {adLoading ? 'جاري تحميل إعلان الإدارة...' : 'لا يوجد إعلان حالياً'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">يرفعه السوبر أدمن ويظهر هنا بدون تحديث التطبيق</p>
            </div>
          </div>
        )}
      </section>

      {/* Device View Mode Selector Card */}
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

      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />

      {/* Settings Folders */}
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

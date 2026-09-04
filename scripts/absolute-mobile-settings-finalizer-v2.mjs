import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
const cssPath = 'src/index.css';

const cleanMobileSettings = String.raw`import React from 'react';
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
  Sliders,
  Sparkles,
  Users,
  Printer,
  Shield,
} from 'lucide-react';
import {
  DeviceViewMode,
  SubscriptionTierPricing,
  GeneratorSpecs,
  LineDistribution,
  SettingsFolderItem,
} from '../../types';
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
  starts_at?: string | null;
  ends_at?: string | null;
  updated_at?: string | null;
};

export const MobileSettings: React.FC<MobileSettingsProps> = ({
  viewMode,
  onChangeViewMode,
  folders,
  onOpenPricingModal,
  onOpenFolderModal,
  onExportData,
  onResetData,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  const [adminAdSlides, setAdminAdSlides] = React.useState<AdminAdSlide[]>([]);
  const [adminAdIndex, setAdminAdIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const loadSlides = async () => {
      try {
        const cached = localStorage.getItem('moldatk_admin_ad_slides');
        if (cached && !cancelled) setAdminAdSlides(JSON.parse(cached));
      } catch (e) {}
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_ad_slides')
          .select('id,title,image_url,link_url,sort_order,starts_at,ends_at,updated_at')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('updated_at', { ascending: false })
          .limit(10);
        if (!error && Array.isArray(data)) {
          const rows = (data as AdminAdSlide[]).filter((slide) =>
            Boolean(slide.image_url) &&
            (!slide.starts_at || slide.starts_at <= now) &&
            (!slide.ends_at || slide.ends_at > now)
          );
          localStorage.setItem('moldatk_admin_ad_slides', JSON.stringify(rows));
          if (!cancelled) {
            setAdminAdSlides(rows);
            setAdminAdIndex(0);
          }
        }
      } catch (e) {}
    };

    void loadSlides();
    const timer = window.setInterval(() => void loadSlides(), 30000);
    window.addEventListener('online', loadSlides);
    window.addEventListener('moldatk-local-sync', loadSlides as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', loadSlides);
      window.removeEventListener('moldatk-local-sync', loadSlides as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (adminAdSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setAdminAdIndex((index) => (index + 1) % adminAdSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [adminAdSlides.length]);

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
      {adminAdSlides.length > 0 && (
        <section className="bg-white dark:bg-[#111c38] rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white">إعلانات الإدارة</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">تتحدث بالمزامنة عند توفر الإنترنت</p>
              </div>
            </div>
            {adminAdSlides.length > 1 && (
              <span className="text-[10px] text-slate-400 font-bold">{adminAdIndex + 1}/{adminAdSlides.length}</span>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: 'translateX(-' + (adminAdIndex * 100) + '%)' }}
            >
              {adminAdSlides.map((slide) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => slide.link_url && window.open(slide.link_url, '_blank')}
                  className="min-w-full shrink-0 block"
                >
                  <img
                    src={slide.image_url}
                    alt={slide.title || 'إعلان الإدارة'}
                    className="w-full aspect-[16/7] object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          {adminAdSlides.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {adminAdSlides.map((_, idx) => (
                <span
                  key={idx}
                  className={(idx === adminAdIndex ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700') + ' h-1.5 rounded-full transition-all'}
                />
              ))}
            </div>
          )}

          {adminAdSlides[adminAdIndex]?.link_url && (
            <p className="mt-2 text-[10px] font-black text-blue-700 dark:text-blue-300">اضغط على الصورة لفتح الرابط</p>
          )}
        </section>
      )}

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">نمط العرض والتوافق مع الأجهزة (View Mode)</h3>
            <p className="text-[10px] text-slate-400">اختر واجهة الهاتف أو واجهة الحاسوب أو الكشف التلقائي</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button onClick={() => onChangeViewMode('mobile')} className={(viewMode === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}>
            <Smartphone className="w-4 h-4 mb-1" />
            <span>هاتف 📱</span>
          </button>
          <button onClick={() => onChangeViewMode('desktop')} className={(viewMode === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}>
            <Monitor className="w-4 h-4 mb-1" />
            <span>حاسوب 🖥️</span>
          </button>
          <button onClick={() => onChangeViewMode('auto')} className={(viewMode === 'auto' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}>
            <RotateCcw className="w-4 h-4 mb-1" />
            <span>تلقائي 🔄</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          {viewMode === 'auto' && 'الوضع الحالي: كشف تلقائي حسب نوع الجهاز.'}
          {viewMode === 'mobile' && 'الوضع الحالي: واجهة الهاتف مفعلة بشكل دائم.'}
          {viewMode === 'desktop' && 'الوضع الحالي: واجهة الحاسوب مفعلة.'}
        </div>
      </div>

      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">فروع وإعدادات المنظومة</h3>
            <p className="text-[10px] text-slate-400">التسعيرة، الجباة، البوردات، الطباعة وباقي الإعدادات</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {folders.map((f) => (
            <div key={f.id} onClick={() => f.folderKey === 'pricing' ? onOpenPricingModal() : onOpenFolderModal(f.folderKey)} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">{getFolderIcon(f.iconName)}</div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{f.titleAr}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {f.badge && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{f.badge}</span>}
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"><Shield className="w-5 h-5" /></div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">النسخ الاحتياطي والبيانات</h3>
            <p className="text-[10px] text-slate-400">تصدير البيانات أو تصفيرها عند الحاجة</p>
          </div>
        </div>
        <button onClick={onExportData} className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white p-3 text-xs font-black">
          <Download className="w-4 h-4" /> تصدير نسخة احتياطية
        </button>
        <button onClick={onResetData} className="w-full rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-xs font-black">
          تصفير بيانات هذا الحساب
        </button>
      </div>
    </div>
  );
};
`;

fs.writeFileSync(mobilePath, cleanMobileSettings);

if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');
  css = css.replace(/\n\/\* WORKMODE_FINAL_MOBILE_UX_BUNDLE_V1: premium mobile themes \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  css = css.replace(/\n\/\* GLOBAL_THEME_COVERAGE_FIX_V1 \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  css = css.replace(/\n\/\* MOBILE_THEME_POPUP_ONLY_V1 \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  fs.writeFileSync(cssPath, css);
}

const result = fs.readFileSync(mobilePath, 'utf8');
for (const forbidden of ['المظهر (Dark / Light)', 'المظهر والثيم', 'Appearance & Theme Toggle', 'بحري هادئ', 'ذهبي فاتح', 'معدني فاتح']) {
  if (result.includes(forbidden)) throw new Error('Forbidden theme text still exists: ' + forbidden);
}
if (!result.includes('adminAdSlides.map')) throw new Error('Admin ad carousel was not written');
if (!result.includes('app_ad_slides')) throw new Error('Supabase app_ad_slides binding missing');

console.log('Absolute v2: MobileSettings replaced with clean no-theme layout and Supabase ad carousel.');

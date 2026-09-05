import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
const superAdminPath = 'src/components/SuperAdminDashboard.tsx';

const mobileSettings = String.raw`import React from 'react';
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
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setAdminAdSlides(parsed);
        }
      } catch (e) {}

      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_ad_slides')
          .select('id,title,image_url,link_url,sort_order,starts_at,ends_at,updated_at')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('updated_at', { ascending: false })
          .limit(20);

        if (!error && Array.isArray(data)) {
          const rows = (data as AdminAdSlide[]).filter((slide) =>
            Boolean(slide.image_url) &&
            (!slide.starts_at || slide.starts_at <= now) &&
            (!slide.ends_at || slide.ends_at > now)
          );
          localStorage.setItem('moldatk_admin_ad_slides', JSON.stringify(rows));
          if (!cancelled) {
            setAdminAdSlides(rows);
            setAdminAdIndex(index => rows.length ? Math.min(index, rows.length - 1) : 0);
          }
        }
      } catch (e) {
        // Cached slides keep working while offline.
      }
    };

    void loadSlides();
    const refreshTimer = window.setInterval(() => void loadSlides(), 30000);
    window.addEventListener('online', loadSlides);
    window.addEventListener('moldatk-local-sync', loadSlides as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener('online', loadSlides);
      window.removeEventListener('moldatk-local-sync', loadSlides as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (adminAdSlides.length <= 1) return;
    const slideTimer = window.setInterval(() => {
      setAdminAdIndex(index => (index + 1) % adminAdSlides.length);
    }, 3500);
    return () => window.clearInterval(slideTimer);
  }, [adminAdSlides.length]);

  const getFolderIcon = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign': return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'Network': return <Network className="w-5 h-5 text-blue-500" />;
      case 'Users': return <Users className="w-5 h-5 text-purple-500" />;
      case 'Printer': return <Printer className="w-5 h-5 text-indigo-500" />;
      default: return <Database className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">
      {adminAdSlides.length > 0 && (
        <section className="w-full rounded-[28px] overflow-hidden bg-slate-200 dark:bg-[#121b2f] shadow-[0_18px_45px_rgba(15,23,42,0.22)] border border-white/10">
          <div className="relative overflow-hidden rounded-[28px]" style={{ direction: 'ltr' }}>
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: 'translateX(-' + (adminAdIndex * 100) + '%)' }}
            >
              {adminAdSlides.map((slide) => {
                const hasLink = Boolean(slide.link_url);
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => hasLink && window.open(slide.link_url || '', '_blank', 'noopener,noreferrer')}
                    className={(hasLink ? 'cursor-pointer' : 'cursor-default') + ' min-w-full shrink-0 block bg-slate-200 dark:bg-slate-900'}
                    aria-label={slide.title || 'إعلان الإدارة'}
                  >
                    <img
                      src={slide.image_url}
                      alt={slide.title || 'إعلان الإدارة'}
                      className="w-full aspect-[16/6] object-cover block"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>

            {adminAdSlides.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
                {adminAdSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAdminAdIndex(idx)}
                    className={(idx === adminAdIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/45') + ' h-1.5 rounded-full shadow transition-all'}
                    aria-label={'إعلان ' + (idx + 1)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Smartphone className="w-5 h-5" /></div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">نمط العرض والتوافق مع الأجهزة (View Mode)</h3>
            <p className="text-[10px] text-slate-400">اختر واجهة الهاتف أو واجهة الحاسوب أو الكشف التلقائي</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button onClick={() => onChangeViewMode('mobile')} className={(viewMode === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}><Smartphone className="w-4 h-4 mb-1" /><span>هاتف 📱</span></button>
          <button onClick={() => onChangeViewMode('desktop')} className={(viewMode === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}><Monitor className="w-4 h-4 mb-1" /><span>حاسوب 🖥️</span></button>
          <button onClick={() => onChangeViewMode('auto')} className={(viewMode === 'auto' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400') + ' flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all'}><RotateCcw className="w-4 h-4 mb-1" /><span>تلقائي 🔄</span></button>
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
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Sliders className="w-5 h-5" /></div>
          <div><h3 className="text-xs font-bold text-slate-900 dark:text-white">فروع وإعدادات المنظومة</h3><p className="text-[10px] text-slate-400">التسعيرة، الجباة، البوردات، الطباعة وباقي الإعدادات</p></div>
        </div>
        <div className="space-y-2 pt-1">
          {folders.map((f) => (
            <div key={f.id} onClick={() => f.folderKey === 'pricing' ? onOpenPricingModal() : onOpenFolderModal(f.folderKey)} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0"><div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">{getFolderIcon(f.iconName)}</div><span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{f.titleAr}</span></div>
              <div className="flex items-center gap-1 shrink-0">{f.badge && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{f.badge}</span>}<ChevronLeft className="w-4 h-4 text-slate-400" /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"><Shield className="w-5 h-5" /></div>
          <div><h3 className="text-xs font-bold text-slate-900 dark:text-white">النسخ الاحتياطي والبيانات</h3><p className="text-[10px] text-slate-400">تصدير البيانات أو تصفيرها عند الحاجة</p></div>
        </div>
        <button onClick={onExportData} className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white p-3 text-xs font-black"><Download className="w-4 h-4" /> تصدير نسخة احتياطية</button>
        <button onClick={onResetData} className="w-full rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-xs font-black">تصفير بيانات هذا الحساب</button>
      </div>
    </div>
  );
};
`;

fs.writeFileSync(mobilePath, mobileSettings);

if (fs.existsSync(superAdminPath)) {
  let src = fs.readFileSync(superAdminPath, 'utf8');

  src = src.replace(
    'UploadCloud\n} from \'lucide-react\';',
    'UploadCloud, Image as ImageIcon, ExternalLink, ToggleLeft, ToggleRight\n} from \'lucide-react\';'
  );

  if (!src.includes('type AdminAdSlide =')) {
    src = src.replace(
      `type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n};`,
      `type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n};\n\ntype AdminAdSlide = {\n  id: string;\n  title: string | null;\n  image_url: string;\n  link_url: string | null;\n  sort_order: number;\n  is_active: boolean;\n  created_at: string;\n  updated_at: string;\n};`
    );
  }

  if (!src.includes('const [adminAdSlides, setAdminAdSlides]')) {
    src = src.replace(
      `  const [notificationForm, setNotificationForm] = useState({\n    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: ''\n  });`,
      `  const [notificationForm, setNotificationForm] = useState({\n    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: ''\n  });\n\n  const [adminAdSlides, setAdminAdSlides] = useState<AdminAdSlide[]>([]);\n  const [adUploading, setAdUploading] = useState(false);\n  const [adFiles, setAdFiles] = useState<File[]>([]);\n  const [adForm, setAdForm] = useState({ title: '', link_url: '', sort_order: '0' });`
    );
  }

  if (!src.includes('void loadAdminAdSlides()')) {
    src = src.replace(
      `  useEffect(() => { void load(); }, []);`,
      `  useEffect(() => { void load(); }, []);\n  useEffect(() => { void loadAdminAdSlides(); }, []);`
    );
  }

  if (!src.includes('const loadAdminAdSlides = async () =>')) {
    src = src.replace(
      `  const resetAllDataForRelease = async () => {`,
      `  const loadAdminAdSlides = async () => {\n    const { data, error } = await supabase\n      .from('app_ad_slides')\n      .select('id,title,image_url,link_url,sort_order,is_active,created_at,updated_at')\n      .order('sort_order', { ascending: true })\n      .order('updated_at', { ascending: false });\n    if (error) {\n      setMessage('تعذر تحميل سلايدات الإعلانات: ' + error.message);\n      return;\n    }\n    setAdminAdSlides((data || []) as AdminAdSlide[]);\n  };\n\n  const uploadAdminAdSlides = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!adFiles.length) return setMessage('اختر صورة إعلان واحدة على الأقل');\n    setAdUploading(true);\n    try {\n      const insertedRows: any[] = [];\n      for (let index = 0; index < adFiles.length; index += 1) {\n        const file = adFiles[index];\n        const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';\n        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50);\n        const path = 'slides/' + Date.now() + '-' + index + '-' + safeName;\n        const { error: uploadError } = await supabase.storage.from('app-ad-slides').upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/' + ext });\n        if (uploadError) throw uploadError;\n        const { data: publicData } = supabase.storage.from('app-ad-slides').getPublicUrl(path);\n        insertedRows.push({\n          slot_key: 'settings_top',\n          title: adForm.title.trim() || null,\n          image_url: publicData.publicUrl,\n          link_url: adForm.link_url.trim() || null,\n          sort_order: Number(adForm.sort_order || 0) + index,\n          is_active: true,\n        });\n      }\n      const { error: insertError } = await supabase.from('app_ad_slides').insert(insertedRows);\n      if (insertError) throw insertError;\n      setAdFiles([]);\n      setAdForm({ title: '', link_url: '', sort_order: '0' });\n      setMessage('تم رفع صور الإعلانات وإضافتها للسلايدر');\n      await loadAdminAdSlides();\n    } catch (err: any) {\n      setMessage('تعذر رفع الإعلان: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setAdUploading(false);\n    }\n  };\n\n  const setAdminAdActive = async (slide: AdminAdSlide, is_active: boolean) => {\n    const { error } = await supabase.from('app_ad_slides').update({ is_active, updated_at: new Date().toISOString() }).eq('id', slide.id);\n    if (error) return setMessage('تعذر تعديل حالة الإعلان: ' + error.message);\n    await loadAdminAdSlides();\n  };\n\n  const deleteAdminAdSlide = async (slide: AdminAdSlide) => {\n    if (!window.confirm('حذف هذا الإعلان من السلايدر؟')) return;\n    const { error } = await supabase.from('app_ad_slides').delete().eq('id', slide.id);\n    if (error) return setMessage('تعذر حذف الإعلان: ' + error.message);\n    setMessage('تم حذف الإعلان');\n    await loadAdminAdSlides();\n  };\n\n  const resetAllDataForRelease = async () => {`
    );
  }

  if (!src.includes('إدارة سلايدات الإعلانات')) {
    src = src.replace(
      `{tab === 'notifications' && <div className="grid grid-cols-[420px_1fr] gap-5">\n            <form onSubmit={sendNotification}`,
      `{tab === 'notifications' && <div className="grid grid-cols-[480px_1fr] gap-5">\n            <div className="space-y-5">\n            <form onSubmit={uploadAdminAdSlides} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">\n              <h2 className="text-lg font-black flex items-center gap-2"><ImageIcon className="w-5 h-5" />إدارة سلايدات الإعلانات</h2>\n              <p className="text-xs text-slate-500 mt-1 mb-5">ارفع أكثر من صورة، وتظهر للمستخدم كسلايدر يتحرك تلقائياً كل 3-4 ثواني. المقاس المقترح 1200×450 أو 16:6.</p>\n              <label className="text-xs font-black text-slate-500">صور الإعلان</label>\n              <input multiple accept="image/*" type="file" onChange={e => setAdFiles(Array.from(e.target.files || []))} className="w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white" />\n              <input placeholder="عنوان داخلي اختياري" value={adForm.title} onChange={e => setAdForm(f => ({...f, title:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3" />\n              <input placeholder="رابط اختياري عند الضغط على الصورة" value={adForm.link_url} onChange={e => setAdForm(f => ({...f, link_url:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3" />\n              <input inputMode="numeric" placeholder="ترتيب الظهور" value={adForm.sort_order} onChange={e => setAdForm(f => ({...f, sort_order:e.target.value.replace(/\\D/g,'')}))} className="w-full border rounded-xl px-3 py-3 mb-3" />\n              <button disabled={adUploading} className="w-full bg-emerald-700 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><UploadCloud className="w-4 h-4" />{adUploading ? 'جاري الرفع...' : 'رفع وإضافة للسلايدر'}</button>\n              <div className="mt-5 space-y-3">\n                {adminAdSlides.map(slide => (\n                  <div key={slide.id} className="border rounded-2xl overflow-hidden bg-slate-50">\n                    <img src={slide.image_url} className="w-full aspect-[16/6] object-cover bg-slate-200" />\n                    <div className="p-3 flex items-center justify-between gap-3">\n                      <div className="min-w-0">\n                        <p className="text-xs font-black truncate">{slide.title || 'إعلان بدون عنوان'}</p>\n                        <p className="text-[10px] text-slate-500">ترتيب: {slide.sort_order || 0} — {slide.is_active ? 'فعال' : 'متوقف'}</p>\n                      </div>\n                      <div className="flex items-center gap-2 shrink-0">\n                        {slide.link_url && <a href={slide.link_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-blue-50 text-blue-700"><ExternalLink className="w-4 h-4" /></a>}\n                        <button type="button" onClick={() => void setAdminAdActive(slide, !slide.is_active)} className="p-2 rounded-lg bg-slate-100 text-slate-700">{slide.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>\n                        <button type="button" onClick={() => void deleteAdminAdSlide(slide)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 className="w-4 h-4" /></button>\n                      </div>\n                    </div>\n                  </div>\n                ))}\n                {adminAdSlides.length === 0 && <div className="p-5 rounded-2xl bg-slate-50 border border-dashed text-center text-sm text-slate-500 font-bold">لا توجد صور إعلانات بعد</div>}\n              </div>\n            </form>\n\n            <form onSubmit={sendNotification}`
    );

    src = src.replace(
      `              <button className="w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" />نشر الإشعار</button>\n            </form>\n            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">`,
      `              <button className="w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" />نشر الإشعار</button>\n            </form>\n            </div>\n            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">`
    );
  }

  fs.writeFileSync(superAdminPath, src);
}

const mobileOut = fs.readFileSync(mobilePath, 'utf8');
if (mobileOut.includes('المظهر والثيم') || mobileOut.includes('بحري هادئ') || mobileOut.includes('ذهبي فاتح')) {
  throw new Error('Theme UI still exists in MobileSettings');
}
if (!mobileOut.includes('adminAdSlides.map') || !mobileOut.includes('3500') || !mobileOut.includes('aspect-[16/6]')) {
  throw new Error('Final mobile ad carousel was not written');
}

const adminOut = fs.existsSync(superAdminPath) ? fs.readFileSync(superAdminPath, 'utf8') : '';
if (!adminOut.includes('إدارة سلايدات الإعلانات') || !adminOut.includes('uploadAdminAdSlides') || !adminOut.includes('multiple accept="image/*"')) {
  throw new Error('Super admin ad multi-upload was not injected');
}

console.log('Final admin ad carousel: multi-image upload, Supabase persistence, mobile auto slider.');

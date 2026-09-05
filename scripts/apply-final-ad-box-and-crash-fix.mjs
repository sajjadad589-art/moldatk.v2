import fs from 'node:fs';

const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

const sliderPath = 'src/components/mobile/MobileAdSlider.tsx';
write(sliderPath, String.raw`import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type MobileAdSlide = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  updated_at: string;
};

const normalizeUrl = (url?: string | null) => {
  const clean = (url || '').trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  return ` + '`https://${clean}`' + `;
};

export const MobileAdSlider: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [slides, setSlides] = useState<MobileAdSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadSlides = async () => {
    const { data, error } = await supabase
      .from('app_ad_slides')
      .select('id,title,image_url,link_url,sort_order,updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[MobileAdSlider] failed to load slides', error.message);
      setSlides([]);
      return;
    }

    const cleanSlides = (data || [])
      .filter((item: any) => typeof item.image_url === 'string' && item.image_url.trim().length > 0)
      .map((item: any) => ({
        id: item.id,
        title: item.title || null,
        image_url: item.image_url.trim(),
        link_url: item.link_url || null,
        sort_order: Number(item.sort_order || 0),
        updated_at: item.updated_at || '',
      }));

    setSlides(cleanSlides);
    setActiveIndex(0);
  };

  useEffect(() => {
    void loadSlides();
    const refresh = () => void loadSlides();
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const polling = window.setInterval(refresh, 45000);
    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(polling);
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <section className={` + '`w-full ${className}`' + `} aria-label="إعلانات الإدارة">
      <div className="relative overflow-hidden rounded-[22px] bg-[#111827] shadow-[0_16px_42px_rgba(2,8,23,0.22)]" dir="ltr">
        <div
          className="flex transition-transform duration-700 ease-out will-change-transform"
          style={{ transform: ` + '`translateX(-${activeIndex * 100}%)`' + ` }}
        >
          {slides.map(slide => {
            const href = normalizeUrl(slide.link_url);
            const image = (
              <img
                src={slide.image_url}
                alt={slide.title || 'إعلان الإدارة'}
                loading="eager"
                className="block w-full h-full object-cover bg-[#111827]"
              />
            );
            return (
              <div key={slide.id} className="min-w-full w-full aspect-[16/6.4] bg-[#111827]">
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block w-full h-full" aria-label={slide.title || 'فتح إعلان الإدارة'}>
                    {image}
                  </a>
                ) : (
                  <div className="w-full h-full">{image}</div>
                )}
              </div>
            );
          })}
        </div>
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5" dir="ltr">
            {slides.map((slide, index) => (
              <button
                key={` + '`dot-${slide.id}`' + `}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={` + '`h-1.5 rounded-full transition-all ${index === activeIndex ? \'w-5 bg-white\' : \'w-1.5 bg-white/45\'}`' + `}
                aria-label={` + '`عرض الإعلان ${index + 1}`' + `}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
`);

const ensureImport = (path) => {
  let src = read(path);
  src = src.replace(/import \{ MobileAdSlider \} from '\.\/MobileAdSlider';\n/g, '');
  src = src.replace("import React", "import { MobileAdSlider } from './MobileAdSlider';\nimport React");
  write(path, src);
};

const cleanPlacement = (path) => {
  let src = read(path);
  src = src.replace(/\n\s*<MobileAdSlider className="[^"]*" \/>\n/g, '\n');
  write(path, src);
};

const dashboardPath = 'src/components/mobile/MobileDashboard.tsx';
ensureImport(dashboardPath);
cleanPlacement(dashboardPath);
let dashboard = read(dashboardPath);
const dashboardMarker = '      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}';
if (!dashboard.includes('<MobileAdSlider className="mt-1" />')) {
  dashboard = dashboard.replace(dashboardMarker, '      <MobileAdSlider className="mt-1" />\n\n' + dashboardMarker);
}
write(dashboardPath, dashboard);

const reportsPath = 'src/components/mobile/MobileMonthlyReports.tsx';
ensureImport(reportsPath);
cleanPlacement(reportsPath);
let reports = read(reportsPath);
const reportsMarker = '      <div className="grid grid-cols-2 gap-2.5">';
if (!reports.includes('<MobileAdSlider className="my-1" />') && reports.includes(reportsMarker)) {
  reports = reports.replace(reportsMarker, '      <MobileAdSlider className="my-1" />\n\n' + reportsMarker);
}
write(reportsPath, reports);

write('src/components/AdminAdSlidesPanel.tsx', String.raw`import React, { useEffect, useState } from 'react';
import { ExternalLink, Image as ImageIcon, ToggleLeft, ToggleRight, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AdminAdSlide = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const AdminAdSlidesPanel: React.FC = () => {
  const [slides, setSlides] = useState<AdminAdSlide[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSlides = async () => {
    const { data, error } = await supabase
      .from('app_ad_slides')
      .select('id,title,image_url,link_url,sort_order,is_active,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });
    if (error) {
      setMessage('تعذر تحميل السلايدات: ' + error.message);
      return;
    }
    setSlides((data || []) as AdminAdSlide[]);
  };

  useEffect(() => { void loadSlides(); }, []);

  const uploadSlides = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) return setMessage('اختر صورة إعلان أولاً');
    setUploading(true);
    setMessage(null);
    try {
      const rows: Array<Record<string, unknown>> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = (file.name || 'ad-image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
        const filePath = ` + '`slides/${Date.now()}-${index}-${safeName}`' + `;
        const { error: uploadError } = await supabase.storage.from('app-ad-slides').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('app-ad-slides').getPublicUrl(filePath);
        rows.push({
          slot_key: 'dashboard_top',
          title: title.trim() || null,
          image_url: publicData.publicUrl,
          link_url: linkUrl.trim() || null,
          sort_order: Number(sortOrder || 0) + index,
          is_active: true,
        });
      }
      const { error: insertError } = await supabase.from('app_ad_slides').insert(rows);
      if (insertError) throw insertError;
      setFiles([]);
      setTitle('');
      setLinkUrl('');
      setSortOrder('0');
      setMessage('تم رفع صورة الإعلان وحفظها. ستظهر للمستخدم عند الاتصال بالإنترنت.');
      await loadSlides();
    } catch (error: any) {
      setMessage('تعذر رفع الإعلان: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setUploading(false);
    }
  };

  const toggleSlide = async (slide: AdminAdSlide) => {
    const { error } = await supabase.from('app_ad_slides').update({ is_active: !slide.is_active, updated_at: new Date().toISOString() }).eq('id', slide.id);
    if (error) return setMessage('تعذر تعديل حالة الإعلان: ' + error.message);
    await loadSlides();
  };

  const deleteSlide = async (slide: AdminAdSlide) => {
    if (!window.confirm('حذف هذا الإعلان؟')) return;
    const { error } = await supabase.from('app_ad_slides').delete().eq('id', slide.id);
    if (error) return setMessage('تعذر حذف الإعلان: ' + error.message);
    setMessage('تم حذف الإعلان');
    await loadSlides();
  };

  return (
    <form onSubmit={uploadSlides} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
      <h2 className="text-lg font-black flex items-center gap-2 text-slate-900">
        <ImageIcon className="w-5 h-5" />
        صندوق إعلانات الإدارة
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-5">الصورة تظهر داخل التطبيق كسلايدر عريض مثل صفحة الإحصائيات. المقاس المقترح 1200×480 أو نسبة 16:6.</p>
      {message && <div className="mb-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 p-3 text-xs font-bold">{message}</div>}
      <label className="block text-xs font-black text-slate-600 mb-1">إرفاق صورة الإعلان</label>
      <input multiple accept="image/*" type="file" onChange={event => setFiles(Array.from(event.target.files || []))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900" />
      <input placeholder="عنوان داخلي اختياري" value={title} onChange={event => setTitle(event.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 text-slate-900" />
      <input placeholder="رابط اختياري عند الضغط على الصورة" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 text-slate-900" />
      <input inputMode="numeric" placeholder="ترتيب الظهور" value={sortOrder} onChange={event => setSortOrder(event.target.value.replace(/\D/g, ''))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 text-slate-900" />
      <button disabled={uploading} className="w-full bg-blue-700 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2">
        <UploadCloud className="w-4 h-4" />
        {uploading ? 'جاري الرفع...' : 'رفع وإضافة الإعلان'}
      </button>
      <div className="mt-5 space-y-3">
        {slides.map(slide => (
          <div key={slide.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <img src={slide.image_url} className="w-full aspect-[16/6] object-cover bg-slate-200" alt={slide.title || 'إعلان'} />
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-black truncate text-slate-900">{slide.title || 'إعلان بدون عنوان'}</p><p className="text-[10px] text-slate-500">ترتيب: {slide.sort_order || 0} — {slide.is_active ? 'فعال' : 'متوقف'}</p></div>
              <div className="flex items-center gap-2 shrink-0">
                {slide.link_url && <a href={slide.link_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-blue-50 text-blue-700"><ExternalLink className="w-4 h-4" /></a>}
                <button type="button" onClick={() => void toggleSlide(slide)} className="p-2 rounded-lg bg-slate-100 text-slate-700">{slide.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                <button type="button" onClick={() => void deleteSlide(slide)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {slides.length === 0 && <div className="p-5 rounded-2xl bg-slate-50 border border-dashed text-center text-sm text-slate-500 font-bold">لا توجد صور إعلانات بعد</div>}
      </div>
    </form>
  );
};
`);

const superPath = 'src/components/SuperAdminDashboard.tsx';
let superSrc = read(superPath);
superSrc = superSrc.replace(/\nimport \{ AdminAdSlidesPanel \} from '\.\/AdminAdSlidesPanel';/g, '');
superSrc = superSrc.replace(/\n\s*const \[[^\n]*(?:adminAd|AdminAd)[^\n]*\n/g, '\n');
superSrc = superSrc.replace(/\n\s*const [^\n]*(?:adminAd|AdminAd)[^\n]*\n/g, '\n');
superSrc = superSrc.replace(/\n\s*async function [^{]*(?:adminAd|AdminAd)[\s\S]*?\n\s*}\n/g, '\n');
superSrc = superSrc.replace(/\n\s*const [^=]*(?:adminAd|AdminAd)[^=]*= async[\s\S]*?\n\s*};\n/g, '\n');
superSrc = superSrc.replace(/\n\s*\{[^{}]*(?:adminAd|AdminAd)[\s\S]*?\}\s*\n/g, '\n');
superSrc = superSrc.replace(/\n\s*<section[\s\S]*?(?:adminAd|AdminAd)[\s\S]*?<\/section>\s*\n/g, '\n');
superSrc = superSrc.replace("import { calculateSubscriberBill } from '../utils/formatters';", "import { calculateSubscriberBill } from '../utils/formatters';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';");
if (!superSrc.includes('<AdminAdSlidesPanel />')) {
  const needle = '<form onSubmit={sendNotification}';
  const idx = superSrc.indexOf(needle);
  if (idx >= 0) superSrc = superSrc.slice(0, idx) + '<AdminAdSlidesPanel />\n            ' + superSrc.slice(idx);
}
write(superPath, superSrc);

const settingsPath = 'src/components/mobile/MobileSettings.tsx';
let settings = read(settingsPath);
settings = settings.replace(/\s*\{adminAdSlides\.length > 0 && \([\s\S]*?<\/section>\s*\)\}/g, '');
settings = settings.replace(/\s*<section[\s\S]*?(المظهر والثيم|اختر اللون المريح|بحري هادئ|ذهبي فاتح|داكن رسمي)[\s\S]*?<\/section>\s*/g, '\n');
settings = settings.replace(/\s*<div[\s\S]*?(View Mode|نمط العرض والتوافق)[\s\S]*?<\/div>\s*/g, '\n');
write(settingsPath, settings);

const finalSuper = read(superPath);
const finalDashboard = read(dashboardPath);
const finalReports = read(reportsPath);
const finalSlider = read(sliderPath);
if (/adminAdTitle|adminAdBody|adminAdSlides\./.test(finalSuper)) throw new Error('Old admin ad variables are still present in SuperAdminDashboard');
if (!finalSuper.includes('<AdminAdSlidesPanel />')) throw new Error('AdminAdSlidesPanel missing from SuperAdminDashboard');
if (!finalDashboard.includes('<MobileAdSlider className="mt-1" />')) throw new Error('Dashboard mobile ad slider missing');
if (!finalReports.includes('<MobileAdSlider className="my-1" />')) throw new Error('Reports mobile ad slider missing');
if (!finalSlider.includes('3500')) throw new Error('Auto carousel interval missing');
console.log('Final admin ad box and crash fix applied.');

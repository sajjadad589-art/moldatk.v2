import React, { useEffect, useState } from 'react';
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
      setMessage('تعذر تحميل سلايدات الإعلانات: ' + error.message);
      return;
    }
    setSlides((data || []) as AdminAdSlide[]);
  };

  useEffect(() => {
    void loadSlides();
  }, []);

  const uploadSlides = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) {
      setMessage('اختر صورة إعلان واحدة على الأقل');
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const rows: Array<Record<string, unknown>> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = (file.name || 'ad-image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
        const filePath = `slides/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('app-ad-slides')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || 'image/jpeg',
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from('app-ad-slides').getPublicUrl(filePath);
        rows.push({
          slot_key: 'settings_top',
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
      setMessage('تم رفع الصور وإضافتها للسلايدر');
      await loadSlides();
    } catch (error: any) {
      setMessage('تعذر رفع الإعلان: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setUploading(false);
    }
  };

  const toggleSlide = async (slide: AdminAdSlide) => {
    const { error } = await supabase
      .from('app_ad_slides')
      .update({ is_active: !slide.is_active, updated_at: new Date().toISOString() })
      .eq('id', slide.id);
    if (error) {
      setMessage('تعذر تعديل حالة الإعلان: ' + error.message);
      return;
    }
    await loadSlides();
  };

  const deleteSlide = async (slide: AdminAdSlide) => {
    if (!window.confirm('حذف هذا الإعلان من السلايدر؟')) return;
    const { error } = await supabase.from('app_ad_slides').delete().eq('id', slide.id);
    if (error) {
      setMessage('تعذر حذف الإعلان: ' + error.message);
      return;
    }
    setMessage('تم حذف الإعلان');
    await loadSlides();
  };

  return (
    <form onSubmit={uploadSlides} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
      <h2 className="text-lg font-black flex items-center gap-2">
        <ImageIcon className="w-5 h-5" />
        إدارة سلايدات الإعلانات
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-5">
        ارفع أكثر من صورة، وتظهر للمستخدم كسلايدر يتحرك تلقائياً كل 3-4 ثواني. المقاس المقترح 1200×450 أو 16:6.
      </p>

      {message && <div className="mb-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 p-3 text-xs font-bold">{message}</div>}

      <label className="text-xs font-black text-slate-500">صور الإعلان</label>
      <input
        multiple
        accept="image/*"
        type="file"
        onChange={event => setFiles(Array.from(event.target.files || []))}
        className="w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white"
      />
      <input
        placeholder="عنوان داخلي اختياري"
        value={title}
        onChange={event => setTitle(event.target.value)}
        className="w-full border rounded-xl px-3 py-3 mb-3"
      />
      <input
        placeholder="رابط اختياري عند الضغط على الصورة"
        value={linkUrl}
        onChange={event => setLinkUrl(event.target.value)}
        className="w-full border rounded-xl px-3 py-3 mb-3"
      />
      <input
        inputMode="numeric"
        placeholder="ترتيب الظهور"
        value={sortOrder}
        onChange={event => setSortOrder(event.target.value.replace(/\D/g, ''))}
        className="w-full border rounded-xl px-3 py-3 mb-3"
      />
      <button
        disabled={uploading}
        className="w-full bg-emerald-700 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"
      >
        <UploadCloud className="w-4 h-4" />
        {uploading ? 'جاري الرفع...' : 'رفع وإضافة للسلايدر'}
      </button>

      <div className="mt-5 space-y-3">
        {slides.map(slide => (
          <div key={slide.id} className="border rounded-2xl overflow-hidden bg-slate-50">
            <img src={slide.image_url} className="w-full aspect-[16/6] object-cover bg-slate-200" />
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{slide.title || 'إعلان بدون عنوان'}</p>
                <p className="text-[10px] text-slate-500">ترتيب: {slide.sort_order || 0} — {slide.is_active ? 'فعال' : 'متوقف'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {slide.link_url && (
                  <a href={slide.link_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-blue-50 text-blue-700">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button type="button" onClick={() => void toggleSlide(slide)} className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  {slide.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => void deleteSlide(slide)} className="p-2 rounded-lg bg-red-50 text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {slides.length === 0 && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-dashed text-center text-sm text-slate-500 font-bold">
            لا توجد صور إعلانات بعد
          </div>
        )}
      </div>
    </form>
  );
};

import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

src = src.replace(/UploadCloud\s*\n}\s+from\s+'lucide-react';/, "UploadCloud, Image as ImageIcon, ExternalLink, ToggleLeft, ToggleRight\n} from 'lucide-react';");

if (!src.includes('type AdminAdSlide =')) {
  src = src.replace(/type Tab = 'overview' \| 'generators' \| 'finance' \| 'notifications';/, `type AdminAdSlide = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Tab = 'overview' | 'generators' | 'finance' | 'notifications';`);
}

if (!src.includes('const [adminAdSlides, setAdminAdSlides]')) {
  src = src.replace(/  const \[notificationForm, setNotificationForm\] = useState\(\{[\s\S]*?generator_id: ''\n  \}\);/, match => `${match}

  const [adminAdSlides, setAdminAdSlides] = useState<AdminAdSlide[]>([]);
  const [adUploading, setAdUploading] = useState(false);
  const [adFiles, setAdFiles] = useState<File[]>([]);
  const [adForm, setAdForm] = useState({ title: '', link_url: '', sort_order: '0' });`);
}

if (!src.includes('useEffect(() => { void loadAdminAdSlides(); }, []);')) {
  src = src.replace(/  useEffect\(\(\) => \{ void load\(\); \}, \[\]\);/, match => `${match}
  useEffect(() => { void loadAdminAdSlides(); }, []);`);
}

if (!src.includes('const loadAdminAdSlides = async () =>')) {
  const functions = String.raw`
  const loadAdminAdSlides = async () => {
    const { data, error } = await supabase
      .from('app_ad_slides')
      .select('id,title,image_url,link_url,sort_order,is_active,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });
    if (error) {
      setMessage('تعذر تحميل سلايدات الإعلانات: ' + error.message);
      return;
    }
    setAdminAdSlides((data || []) as AdminAdSlide[]);
  };

  const uploadAdminAdSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adFiles.length) return setMessage('اختر صورة إعلان واحدة على الأقل');
    setAdUploading(true);
    try {
      const insertedRows: any[] = [];
      for (let index = 0; index < adFiles.length; index += 1) {
        const file = adFiles[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50) || 'ad-image.jpg';
        const filePath = 'slides/' + Date.now() + '-' + index + '-' + safeName;
        const { error: uploadError } = await supabase.storage
          .from('app-ad-slides')
          .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('app-ad-slides').getPublicUrl(filePath);
        insertedRows.push({
          slot_key: 'settings_top',
          title: adForm.title.trim() || null,
          image_url: publicData.publicUrl,
          link_url: adForm.link_url.trim() || null,
          sort_order: Number(adForm.sort_order || 0) + index,
          is_active: true,
        });
      }
      const { error: insertError } = await supabase.from('app_ad_slides').insert(insertedRows);
      if (insertError) throw insertError;
      setAdFiles([]);
      setAdForm({ title: '', link_url: '', sort_order: '0' });
      setMessage('تم رفع صور الإعلانات وإضافتها للسلايدر');
      await loadAdminAdSlides();
    } catch (err: any) {
      setMessage('تعذر رفع الإعلان: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setAdUploading(false);
    }
  };

  const setAdminAdActive = async (slide: AdminAdSlide, is_active: boolean) => {
    const { error } = await supabase.from('app_ad_slides').update({ is_active, updated_at: new Date().toISOString() }).eq('id', slide.id);
    if (error) return setMessage('تعذر تعديل حالة الإعلان: ' + error.message);
    await loadAdminAdSlides();
  };

  const deleteAdminAdSlide = async (slide: AdminAdSlide) => {
    if (!window.confirm('حذف هذا الإعلان من السلايدر؟')) return;
    const { error } = await supabase.from('app_ad_slides').delete().eq('id', slide.id);
    if (error) return setMessage('تعذر حذف الإعلان: ' + error.message);
    setMessage('تم حذف الإعلان');
    await loadAdminAdSlides();
  };

`;
  src = src.replace(/  const resetAllDataForRelease = async \(\) => \{/, functions + '  const resetAllDataForRelease = async () => {');
}

if (!src.includes('إدارة سلايدات الإعلانات')) {
  const adManager = String.raw`            <div className="space-y-5">
            <form onSubmit={uploadAdminAdSlides} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
              <h2 className="text-lg font-black flex items-center gap-2"><ImageIcon className="w-5 h-5" />إدارة سلايدات الإعلانات</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">ارفع أكثر من صورة، وتظهر للمستخدم كسلايدر يتحرك تلقائياً كل 3-4 ثواني. المقاس المقترح 1200×450 أو 16:6.</p>
              <label className="text-xs font-black text-slate-500">صور الإعلان</label>
              <input multiple accept="image/*" type="file" onChange={e => setAdFiles(Array.from(e.target.files || []))} className="w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white" />
              <input placeholder="عنوان داخلي اختياري" value={adForm.title} onChange={e => setAdForm(f => ({...f, title:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3" />
              <input placeholder="رابط اختياري عند الضغط على الصورة" value={adForm.link_url} onChange={e => setAdForm(f => ({...f, link_url:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3" />
              <input inputMode="numeric" placeholder="ترتيب الظهور" value={adForm.sort_order} onChange={e => setAdForm(f => ({...f, sort_order:e.target.value.replace(/\D/g,'')}))} className="w-full border rounded-xl px-3 py-3 mb-3" />
              <button disabled={adUploading} className="w-full bg-emerald-700 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><UploadCloud className="w-4 h-4" />{adUploading ? 'جاري الرفع...' : 'رفع وإضافة للسلايدر'}</button>
              <div className="mt-5 space-y-3">
                {adminAdSlides.map(slide => (
                  <div key={slide.id} className="border rounded-2xl overflow-hidden bg-slate-50">
                    <img src={slide.image_url} className="w-full aspect-[16/6] object-cover bg-slate-200" />
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="text-xs font-black truncate">{slide.title || 'إعلان بدون عنوان'}</p><p className="text-[10px] text-slate-500">ترتيب: {slide.sort_order || 0} — {slide.is_active ? 'فعال' : 'متوقف'}</p></div>
                      <div className="flex items-center gap-2 shrink-0">
                        {slide.link_url && <a href={slide.link_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-blue-50 text-blue-700"><ExternalLink className="w-4 h-4" /></a>}
                        <button type="button" onClick={() => void setAdminAdActive(slide, !slide.is_active)} className="p-2 rounded-lg bg-slate-100 text-slate-700">{slide.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                        <button type="button" onClick={() => void deleteAdminAdSlide(slide)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {adminAdSlides.length === 0 && <div className="p-5 rounded-2xl bg-slate-50 border border-dashed text-center text-sm text-slate-500 font-bold">لا توجد صور إعلانات بعد</div>}
              </div>
            </form>

`;
  src = src.replace(/\{tab === 'notifications' && <div className="grid grid-cols-\[420px_1fr\] gap-5">\s*<form onSubmit=\{sendNotification\}/, `{tab === 'notifications' && <div className="grid grid-cols-[480px_1fr] gap-5">
` + adManager + `            <form onSubmit={sendNotification}`);

  src = src.replace(/(<button className="w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" \/>نشر الإشعار<\/button>\s*<\/form>)\s*<section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">/, `$1
            </div>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">`);
}

fs.writeFileSync(path, src);

const out = fs.readFileSync(path, 'utf8');
if (!out.includes('إدارة سلايدات الإعلانات') || !out.includes('uploadAdminAdSlides') || !out.includes('multiple accept="image/*"')) {
  throw new Error('Regex super admin ad multi-upload injection failed');
}
console.log('Super admin ad multi-upload injected with regex.');

import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileUp, Globe2, Loader2, MessageCircle, Save, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import {
  activateRelease,
  AppRelease,
  createRelease,
  DEFAULT_SITE_SETTINGS,
  deleteRelease,
  loadReleases,
  loadSiteSettings,
  saveSiteSettings,
  SiteSettings,
  whatsappUrl,
} from '../lib/siteManagement';

const formatBytes = (value?: number | null) => {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const WebsiteReleaseManager: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ versionName: '', versionCode: '', releaseNotes: '', mandatory: false, file: null as File | null });

  const activeRelease = useMemo(() => releases.find(r => r.is_active) || null, [releases]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [site, allReleases] = await Promise.all([loadSiteSettings(), loadReleases(true)]);
      setSettings(site);
      setReleases(allReleases);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل إعدادات الموقع والإصدارات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveSiteSettings({
        whatsapp_phone: settings.whatsapp_phone,
        whatsapp_message: settings.whatsapp_message,
        hero_title: settings.hero_title,
        hero_subtitle: settings.hero_subtitle,
        android_download_enabled: settings.android_download_enabled,
      });
      setSettings(saved);
      setMessage('تم حفظ إعدادات الموقع بنجاح.');
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ إعدادات الموقع');
    } finally {
      setSaving(false);
    }
  };

  const uploadRelease = async () => {
    if (!form.file) return setError('اختار ملف APK أولاً.');
    if (!form.versionName.trim()) return setError('اكتب رقم الإصدار مثل 1.1.1');
    const versionCode = Number(form.versionCode);
    if (!Number.isInteger(versionCode) || versionCode <= 0) return setError('Version Code لازم يكون رقم صحيح أكبر من صفر.');
    if (!form.file.name.toLowerCase().endsWith('.apk')) return setError('الملف لازم يكون بصيغة APK.');

    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const release = await createRelease({
        versionName: form.versionName.trim(),
        versionCode,
        releaseNotes: form.releaseNotes.trim(),
        file: form.file,
        mandatory: form.mandatory,
      });
      setReleases(prev => [release, ...prev]);
      setForm({ versionName: '', versionCode: '', releaseNotes: '', mandatory: false, file: null });
      setMessage('تم رفع نسخة Android. اضغط «اعتماد هذا الإصدار» حتى يظهر بالموقع ويصل للتطبيقات.');
    } catch (e: any) {
      setError(e?.message || 'تعذر رفع الإصدار');
    } finally {
      setUploading(false);
    }
  };

  const makeActive = async (release: AppRelease) => {
    setError(null);
    setMessage(null);
    try {
      await activateRelease(release.id);
      await refresh();
      setMessage(`تم اعتماد الإصدار ${release.version_name}. صار هو الإصدار الرسمي بالموقع ونظام التحديث.`);
    } catch (e: any) {
      setError(e?.message || 'تعذر اعتماد الإصدار');
    }
  };

  const removeRelease = async (release: AppRelease) => {
    if (!window.confirm(`حذف الإصدار ${release.version_name}؟`)) return;
    setError(null);
    try {
      await deleteRelease(release);
      setReleases(prev => prev.filter(x => x.id !== release.id));
      setMessage('تم حذف الإصدار.');
    } catch (e: any) {
      setError(e?.message || 'تعذر حذف الإصدار');
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin"/> جاري تحميل إدارة الموقع...</div>;
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-300 mb-2"><Globe2 className="w-4 h-4"/> إدارة الموقع والإصدارات</div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">تحكم بالموقع وتحديثات Android من مكان واحد</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">ارفع APK، اعتمد الإصدار، وعدّل معلومات التواصل بدون الحاجة إلى GitHub أو Vercel.</p>
        </div>
        <a href="/download" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900">
          معاينة الموقع <ExternalLink className="w-4 h-4"/>
        </a>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-bold">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-bold">{message}</div>}

      <div className="grid xl:grid-cols-2 gap-5">
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><MessageCircle className="w-5 h-5"/></div>
            <div><h3 className="font-black text-slate-900 dark:text-white">إعدادات الموقع</h3><p className="text-xs text-slate-500 mt-1">واتساب والنصوص الرئيسية وحالة تحميل Android.</p></div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم واتساب
              <input value={settings.whatsapp_phone} onChange={e=>setSettings({...settings, whatsapp_phone:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"/>
            </label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">رسالة واتساب الجاهزة
              <input value={settings.whatsapp_message} onChange={e=>setSettings({...settings, whatsapp_message:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"/>
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">العنوان الرئيسي للموقع
            <input value={settings.hero_title} onChange={e=>setSettings({...settings, hero_title:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"/>
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">الوصف الرئيسي
            <textarea rows={3} value={settings.hero_subtitle} onChange={e=>setSettings({...settings, hero_subtitle:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-950 px-4 py-3 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <div><div className="font-black text-sm text-slate-800 dark:text-white">إظهار زر تحميل Android</div><div className="text-[11px] text-slate-500 mt-1">يفضّل تفعيله فقط بعد اعتماد Release رسمي.</div></div>
            <input type="checkbox" checked={settings.android_download_enabled} onChange={e=>setSettings({...settings, android_download_enabled:e.target.checked})} className="w-5 h-5"/>
          </label>

          <div className="flex flex-wrap gap-3">
            <button onClick={saveSettings} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-black"><Save className="w-4 h-4"/>{saving?'جاري الحفظ...':'حفظ إعدادات الموقع'}</button>
            <a href={whatsappUrl(settings.whatsapp_phone, settings.whatsapp_message)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-black">اختبار واتساب <ExternalLink className="w-4 h-4"/></a>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center"><FileUp className="w-5 h-5"/></div>
            <div><h3 className="font-black text-slate-900 dark:text-white">رفع إصدار Android جديد</h3><p className="text-xs text-slate-500 mt-1">الرفع وحده لا ينشر التحديث؛ بعده تختار اعتماد الإصدار.</p></div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Version Name
              <input placeholder="مثال: 1.1.1" value={form.versionName} onChange={e=>setForm({...form, versionName:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5"/>
            </label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Version Code
              <input inputMode="numeric" placeholder="مثال: 3" value={form.versionCode} onChange={e=>setForm({...form, versionCode:e.target.value.replace(/\D/g,'')})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5"/>
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">ملاحظات التحديث
            <textarea rows={3} placeholder="مثال: تحسين الطباعة وإصلاح مشكلة الفلاتر" value={form.releaseNotes} onChange={e=>setForm({...form, releaseNotes:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 resize-none"/>
          </label>

          <label className="block rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-5 text-center cursor-pointer hover:border-blue-400">
            <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={e=>setForm({...form, file:e.target.files?.[0] || null})}/>
            <FileUp className="w-7 h-7 mx-auto text-blue-600 mb-2"/>
            <div className="font-black text-sm text-slate-800 dark:text-white">{form.file ? form.file.name : 'اضغط لاختيار ملف APK'}</div>
            {form.file && <div className="text-xs text-slate-500 mt-1">{formatBytes(form.file.size)}</div>}
          </label>

          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.mandatory} onChange={e=>setForm({...form, mandatory:e.target.checked})} className="w-5 h-5"/> تحديث إجباري للمستخدمين</label>

          <button onClick={uploadRelease} disabled={uploading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white px-4 py-3 font-black disabled:opacity-60">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <FileUp className="w-5 h-5"/>}{uploading?'جاري رفع APK...':'رفع النسخة إلى الموقع'}
          </button>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
          <div><h3 className="font-black text-slate-900 dark:text-white">سجل إصدارات Android</h3><p className="text-xs text-slate-500 mt-1">الإصدار النشط هو اللي يظهر بالموقع ويستعمله فاحص التحديث.</p></div>
          {activeRelease && <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-black"><ShieldCheck className="w-4 h-4"/> الرسمي: {activeRelease.version_name}</div>}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {releases.length === 0 && <div className="p-8 text-center text-sm text-slate-500">ماكو أي إصدار مرفوع حالياً.</div>}
          {releases.map(release => (
            <div key={release.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${release.is_active?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}`}><Smartphone className="w-5 h-5"/></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-900 dark:text-white">v{release.version_name}</span><span className="text-xs text-slate-500">Code {release.version_code}</span>{release.is_mandatory && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-black">إجباري</span>}{release.is_active && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-black">نشط</span>}</div>
                  <div className="text-xs text-slate-500 mt-1">{formatBytes(release.file_size)} • {new Date(release.created_at).toLocaleString('ar-IQ')}</div>
                  {release.release_notes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">{release.release_notes}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <a href={release.apk_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black"><Download className="w-4 h-4"/> APK</a>
                {!release.is_active && <button onClick={()=>makeActive(release)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-black"><ShieldCheck className="w-4 h-4"/> اعتماد هذا الإصدار</button>}
                {!release.is_active && <button onClick={()=>removeRelease(release)} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-black"><Trash2 className="w-4 h-4"/> حذف</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

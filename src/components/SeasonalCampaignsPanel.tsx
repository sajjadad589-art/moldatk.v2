import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Image as ImageIcon,
  Palette,
  Pencil,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type ThemeKey = 'default' | 'eid' | 'ramadan' | 'ashura' | 'arbaeen' | 'new_year' | 'christmas' | 'summer' | 'custom';

type SeasonalCampaign = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  priority: number;
  theme_key: ThemeKey;
  accent_color: string | null;
  accent_soft_color: string | null;
  icon_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  offer_title: string | null;
  offer_body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  launcher_icon_key: string;
  created_at: string;
  updated_at: string;
};

type AssetKind = 'icon' | 'logo' | 'banner';

type FormState = {
  name: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  themeKey: ThemeKey;
  accentColor: string;
  accentSoftColor: string;
  iconUrl: string;
  logoUrl: string;
  bannerUrl: string;
  offerTitle: string;
  offerBody: string;
  ctaLabel: string;
  ctaUrl: string;
  launcherIconKey: string;
  isActive: boolean;
};

const toLocalInput = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
};

const makeEmptyForm = (): FormState => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  return {
    name: '',
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(end),
    priority: '0',
    themeKey: 'default',
    accentColor: '#0f766e',
    accentSoftColor: '#ccfbf1',
    iconUrl: '',
    logoUrl: '',
    bannerUrl: '',
    offerTitle: '',
    offerBody: '',
    ctaLabel: '',
    ctaUrl: '',
    launcherIconKey: 'default',
    isActive: true,
  };
};

const themeOptions: Array<{ value: ThemeKey; label: string }> = [
  { value: 'default', label: 'الهوية الأصلية' },
  { value: 'eid', label: 'العيد' },
  { value: 'ramadan', label: 'رمضان' },
  { value: 'ashura', label: 'عاشوراء' },
  { value: 'arbaeen', label: 'الأربعين' },
  { value: 'new_year', label: 'رأس السنة' },
  { value: 'christmas', label: 'الكريسماس' },
  { value: 'summer', label: 'عروض الصيف' },
  { value: 'custom', label: 'مخصص' },
];

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

export const SeasonalCampaignsPanel: React.FC = () => {
  const [campaigns, setCampaigns] = useState<SeasonalCampaign[]>([]);
  const [form, setForm] = useState<FormState>(() => makeEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeNow = useMemo(() => {
    const now = Date.now();
    return campaigns
      .filter(c => c.is_active && new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() > now)
      .sort((a, b) => b.priority - a.priority || new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0] || null;
  }, [campaigns]);

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('seasonal_campaigns')
      .select('*')
      .order('starts_at', { ascending: false });
    if (error) {
      setMessage('تعذر تحميل المواسم: ' + error.message);
      return;
    }
    setCampaigns((data || []) as SeasonalCampaign[]);
  };

  useEffect(() => {
    void loadCampaigns();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(makeEmptyForm());
    setMessage(null);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const uploadAsset = async (kind: AssetKind, file: File | null) => {
    if (!file) return;
    setUploading(kind);
    setMessage(null);
    try {
      const safeName = (file.name || `${kind}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 70);
      const path = `seasonal/${kind}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('app-ad-slides').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('app-ad-slides').getPublicUrl(path);
      const url = data.publicUrl;
      if (kind === 'icon') updateForm('iconUrl', url);
      if (kind === 'logo') updateForm('logoUrl', url);
      if (kind === 'banner') updateForm('bannerUrl', url);
      setMessage('تم رفع الصورة بنجاح');
    } catch (error: any) {
      setMessage('تعذر رفع الصورة: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setUploading(null);
    }
  };

  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage('اكتب اسم الموسم أو المناسبة');
      return;
    }
    const starts = new Date(form.startsAt);
    const ends = new Date(form.endsAt);
    if (!form.startsAt || !form.endsAt || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      setMessage('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }

    setSaving(true);
    setMessage(null);
    const payload = {
      name: form.name.trim(),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      is_active: form.isActive,
      priority: Math.max(0, Number(form.priority || 0)),
      theme_key: form.themeKey,
      accent_color: form.accentColor || null,
      accent_soft_color: form.accentSoftColor || null,
      icon_url: form.iconUrl || null,
      logo_url: form.logoUrl || null,
      banner_url: form.bannerUrl || null,
      offer_title: form.offerTitle.trim() || null,
      offer_body: form.offerBody.trim() || null,
      cta_label: form.ctaLabel.trim() || null,
      cta_url: form.ctaUrl.trim() || null,
      launcher_icon_key: form.launcherIconKey || 'default',
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('seasonal_campaigns').update(payload).eq('id', editingId);
        if (error) throw error;
        setMessage('تم تحديث الموسم');
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { error } = await supabase.from('seasonal_campaigns').insert({
          ...payload,
          created_by: authData.user?.id || null,
        });
        if (error) throw error;
        setMessage('تم إنشاء الموسم وجدولته');
      }
      setEditingId(null);
      setForm(makeEmptyForm());
      await loadCampaigns();
      window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
    } catch (error: any) {
      setMessage('تعذر حفظ الموسم: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const editCampaign = (campaign: SeasonalCampaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      startsAt: toLocalInput(new Date(campaign.starts_at)),
      endsAt: toLocalInput(new Date(campaign.ends_at)),
      priority: String(campaign.priority || 0),
      themeKey: campaign.theme_key || 'default',
      accentColor: campaign.accent_color || '#0f766e',
      accentSoftColor: campaign.accent_soft_color || '#ccfbf1',
      iconUrl: campaign.icon_url || '',
      logoUrl: campaign.logo_url || '',
      bannerUrl: campaign.banner_url || '',
      offerTitle: campaign.offer_title || '',
      offerBody: campaign.offer_body || '',
      ctaLabel: campaign.cta_label || '',
      ctaUrl: campaign.cta_url || '',
      launcherIconKey: campaign.launcher_icon_key || 'default',
      isActive: campaign.is_active,
    });
    setMessage(null);
  };

  const toggleCampaign = async (campaign: SeasonalCampaign) => {
    const { error } = await supabase
      .from('seasonal_campaigns')
      .update({ is_active: !campaign.is_active, updated_at: new Date().toISOString() })
      .eq('id', campaign.id);
    if (error) {
      setMessage('تعذر تغيير حالة الموسم: ' + error.message);
      return;
    }
    await loadCampaigns();
    window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
  };

  const deleteCampaign = async (campaign: SeasonalCampaign) => {
    if (!window.confirm(`حذف الموسم "${campaign.name}"؟`)) return;
    const { error } = await supabase.from('seasonal_campaigns').delete().eq('id', campaign.id);
    if (error) {
      setMessage('تعذر حذف الموسم: ' + error.message);
      return;
    }
    if (editingId === campaign.id) resetForm();
    setMessage('تم حذف الموسم');
    await loadCampaigns();
    window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            المواسم والمناسبات
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            جدولة هوية موسمية، بانر وعرض وأيقونة داخلية. يبدأ الموسم وينتهي تلقائياً ويرجع التطبيق للهوية الأصلية بعد انتهائه.
          </p>
        </div>
        {activeNow && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
            الفعّال الآن: {activeNow.name}
          </div>
        )}
      </div>

      {message && <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 p-3 text-xs font-bold">{message}</div>}

      <form onSubmit={saveCampaign} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-black text-slate-600">اسم الموسم / المناسبة</label>
            <input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="مثال: عيد الفطر 2027" className="w-full border rounded-xl px-3 py-3 mt-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-600">بداية الموسم</label>
              <input type="datetime-local" value={form.startsAt} onChange={e => updateForm('startsAt', e.target.value)} className="w-full border rounded-xl px-3 py-3 mt-1" />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600">نهاية الموسم</label>
              <input type="datetime-local" value={form.endsAt} onChange={e => updateForm('endsAt', e.target.value)} className="w-full border rounded-xl px-3 py-3 mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-600">نوع الثيم</label>
              <select value={form.themeKey} onChange={e => updateForm('themeKey', e.target.value as ThemeKey)} className="w-full border rounded-xl px-3 py-3 mt-1 bg-white">
                {themeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-600">الأولوية</label>
              <input inputMode="numeric" value={form.priority} onChange={e => updateForm('priority', e.target.value.replace(/\D/g, ''))} className="w-full border rounded-xl px-3 py-3 mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-black text-slate-600 flex items-center gap-2">
              <Palette className="w-4 h-4" /> اللون الرئيسي
              <input type="color" value={form.accentColor} onChange={e => updateForm('accentColor', e.target.value)} className="h-10 w-14 border rounded-lg bg-white p-1" />
            </label>
            <label className="text-xs font-black text-slate-600 flex items-center gap-2">
              <Palette className="w-4 h-4" /> اللون الهادئ
              <input type="color" value={form.accentSoftColor} onChange={e => updateForm('accentSoftColor', e.target.value)} className="h-10 w-14 border rounded-lg bg-white p-1" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['icon', 'logo', 'banner'] as AssetKind[]).map(kind => {
              const label = kind === 'icon' ? 'أيقونة الموسم' : kind === 'logo' ? 'لوجو الموسم' : 'بانر الموسم';
              const value = kind === 'icon' ? form.iconUrl : kind === 'logo' ? form.logoUrl : form.bannerUrl;
              return (
                <label key={kind} className="border border-dashed rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50">
                  <input type="file" accept="image/*" className="hidden" onChange={e => void uploadAsset(kind, e.target.files?.[0] || null)} />
                  {value ? <img src={value} alt={label} className="w-full h-20 object-contain rounded-lg mb-2 bg-slate-50" /> : <ImageIcon className="w-6 h-6 mx-auto mb-2 text-slate-400" />}
                  <span className="text-[11px] font-black text-slate-600 flex items-center justify-center gap-1"><UploadCloud className="w-3.5 h-3.5" />{uploading === kind ? 'جاري الرفع...' : label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <input value={form.offerTitle} onChange={e => updateForm('offerTitle', e.target.value)} placeholder="عنوان العرض - مثال: خصم خاص بمناسبة العيد" className="w-full border rounded-xl px-3 py-3" />
          <textarea value={form.offerBody} onChange={e => updateForm('offerBody', e.target.value)} placeholder="وصف مختصر للعرض أو التهنئة" rows={3} className="w-full border rounded-xl px-3 py-3 resize-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.ctaLabel} onChange={e => updateForm('ctaLabel', e.target.value)} placeholder="نص الزر - شاهد العرض" className="w-full border rounded-xl px-3 py-3" />
            <input value={form.ctaUrl} onChange={e => updateForm('ctaUrl', e.target.value)} placeholder="رابط الزر (اختياري)" className="w-full border rounded-xl px-3 py-3" />
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: form.accentColor || undefined }}>
            <div className="flex items-start gap-3">
              {form.logoUrl || form.iconUrl ? <img src={form.logoUrl || form.iconUrl} alt="معاينة" className="w-14 h-14 object-contain rounded-xl bg-white border" /> : <Sparkles className="w-10 h-10 text-slate-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black" style={{ color: form.accentColor }}>{form.name || 'معاينة الموسم'}</p>
                <p className="font-black mt-1">{form.offerTitle || 'عنوان العرض يظهر هنا'}</p>
                <p className="text-xs text-slate-500 mt-1">{form.offerBody || 'وصف العرض أو رسالة المناسبة تظهر هنا.'}</p>
              </div>
            </div>
            {form.bannerUrl && <img src={form.bannerUrl} alt="بانر الموسم" className="w-full aspect-[16/6] object-cover rounded-xl mt-3" />}
          </div>

          <label className="flex items-center justify-between gap-3 border rounded-xl px-3 py-3">
            <span className="text-xs font-black">تفعيل الموسم</span>
            <input type="checkbox" checked={form.isActive} onChange={e => updateForm('isActive', e.target.checked)} className="w-5 h-5" />
          </label>

          <div className="flex flex-wrap gap-2">
            <button disabled={saving || uploading !== null} className="flex-1 min-w-[180px] bg-emerald-700 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إنشاء وجدولة الموسم'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-3 rounded-xl border font-black text-sm flex items-center gap-2">
                <X className="w-4 h-4" /> إلغاء
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="mt-6 border-t pt-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4" /> المواسم المجدولة</h3>
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const isLive = activeNow?.id === campaign.id;
            return (
              <div key={campaign.id} className={`rounded-2xl border p-3 ${isLive ? 'border-emerald-300 bg-emerald-50' : 'bg-slate-50'}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {campaign.icon_url ? <img src={campaign.icon_url} alt="" className="w-11 h-11 object-contain rounded-xl bg-white border" /> : <Sparkles className="w-8 h-8 text-slate-400" />}
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate">{campaign.name} {isLive && <span className="text-emerald-700">• فعّال الآن</span>}</p>
                      <p className="text-[11px] text-slate-500">{formatDate(campaign.starts_at)} ← {formatDate(campaign.ends_at)} · أولوية {campaign.priority}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => editCampaign(campaign)} className="p-2 rounded-lg bg-white border text-slate-700" title="تعديل"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => void toggleCampaign(campaign)} className="p-2 rounded-lg bg-white border text-slate-700" title="تفعيل/إيقاف">
                      {campaign.is_active ? <ToggleRight className="w-4 h-4 text-emerald-700" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => void deleteCampaign(campaign)} className="p-2 rounded-lg bg-red-50 text-red-700" title="حذف"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {campaigns.length === 0 && <div className="p-5 rounded-2xl border border-dashed text-center text-sm text-slate-500 font-bold">لا توجد مواسم مجدولة بعد</div>}
        </div>
      </div>
    </section>
  );
};

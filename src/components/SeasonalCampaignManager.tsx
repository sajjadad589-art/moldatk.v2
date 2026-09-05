import React, { useEffect, useState } from 'react';
import { CalendarClock, Image as ImageIcon, Loader2, Save, Sparkles, ToggleLeft, ToggleRight, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Campaign = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  priority: number;
  theme_key: string;
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
};

const localValue = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 16);
};

export const SeasonalCampaignManager: React.FC = () => {
  const [items, setItems] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name:'', starts_at:localValue(), ends_at:localValue(new Date(Date.now()+7*86400000)), priority:'0',
    theme_key:'custom', accent_color:'#0f766e', accent_soft_color:'#ccfbf1', offer_title:'', offer_body:'', cta_label:'شاهد العرض', cta_url:''
  });

  const load = async () => {
    const { data, error } = await supabase.from('seasonal_campaigns').select('*').order('starts_at', { ascending:false });
    if (error) setMessage(`تعذر تحميل المواسم: ${error.message}`);
    else setItems((data || []) as Campaign[]);
  };
  useEffect(() => { void load(); }, []);

  const upload = async (file: File | null, prefix: string) => {
    if (!file) return null;
    const safe = (file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,60);
    const path = `seasons/${prefix}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('app-ad-slides').upload(path, file, { upsert:true, contentType:file.type || 'image/png' });
    if (error) throw error;
    return supabase.storage.from('app-ad-slides').getPublicUrl(path).data.publicUrl;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setMessage('اكتب اسم الموسم أو المناسبة');
    const start = new Date(form.starts_at); const end = new Date(form.ends_at);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return setMessage('تأكد من تاريخ البداية والنهاية');
    setBusy(true); setMessage(null);
    try {
      const [iconUrl, logoUrl, bannerUrl] = await Promise.all([upload(iconFile,'icon'), upload(logoFile,'logo'), upload(bannerFile,'banner')]);
      const { data:user } = await supabase.auth.getUser();
      const { error } = await supabase.from('seasonal_campaigns').insert({
        name:form.name.trim(), starts_at:start.toISOString(), ends_at:end.toISOString(), is_active:true,
        priority:Number(form.priority || 0), theme_key:form.theme_key || 'custom', accent_color:form.accent_color || null,
        accent_soft_color:form.accent_soft_color || null, icon_url:iconUrl, logo_url:logoUrl, banner_url:bannerUrl,
        offer_title:form.offer_title.trim() || null, offer_body:form.offer_body.trim() || null,
        cta_label:form.cta_label.trim() || null, cta_url:form.cta_url.trim() || null,
        launcher_icon_key:'default', created_by:user.user?.id || null,
      });
      if (error) throw error;
      setForm({ name:'', starts_at:localValue(), ends_at:localValue(new Date(Date.now()+7*86400000)), priority:'0', theme_key:'custom', accent_color:'#0f766e', accent_soft_color:'#ccfbf1', offer_title:'', offer_body:'', cta_label:'شاهد العرض', cta_url:'' });
      setIconFile(null); setLogoFile(null); setBannerFile(null); setMessage('تم إنشاء الموسم وجدولته');
      await load();
      window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
    } catch (e:any) { setMessage(e?.message || 'تعذر حفظ الموسم'); }
    finally { setBusy(false); }
  };

  const toggle = async (item: Campaign) => {
    const { error } = await supabase.from('seasonal_campaigns').update({ is_active:!item.is_active, updated_at:new Date().toISOString() }).eq('id',item.id);
    if (error) return setMessage(error.message);
    await load(); window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
  };
  const remove = async (item: Campaign) => {
    if (!window.confirm(`حذف موسم ${item.name}؟`)) return;
    const { error } = await supabase.from('seasonal_campaigns').delete().eq('id',item.id);
    if (error) return setMessage(error.message);
    await load(); window.dispatchEvent(new Event('moldatk-seasonal-refresh'));
  };

  return <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
    <h2 className="text-lg font-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-600"/> المواسم والمناسبات</h2>
    <p className="text-xs text-slate-500 mt-1 mb-4">جدولة هوية وعرض موسمي بدون المساس بالحسابات أو التسديدات.</p>
    {message && <div className="mb-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 p-3 text-xs font-bold">{message}</div>}
    <form onSubmit={save} className="space-y-2">
      <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="اسم المناسبة: عيد الفطر، رمضان..." className="w-full border rounded-xl px-3 py-2.5"/>
      <div className="grid grid-cols-2 gap-2"><input type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})} className="border rounded-xl px-3 py-2.5"/><input type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})} className="border rounded-xl px-3 py-2.5"/></div>
      <div className="grid grid-cols-3 gap-2"><input value={form.offer_title} onChange={e=>setForm({...form,offer_title:e.target.value})} placeholder="عنوان العرض" className="col-span-2 border rounded-xl px-3 py-2.5"/><input inputMode="numeric" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value.replace(/\D/g,'')})} placeholder="الأولوية" className="border rounded-xl px-3 py-2.5"/></div>
      <textarea value={form.offer_body} onChange={e=>setForm({...form,offer_body:e.target.value})} placeholder="نص العرض أو التهنئة" className="w-full border rounded-xl px-3 py-2.5 min-h-20"/>
      <div className="grid grid-cols-2 gap-2"><input value={form.cta_label} onChange={e=>setForm({...form,cta_label:e.target.value})} placeholder="نص الزر" className="border rounded-xl px-3 py-2.5"/><input value={form.cta_url} onChange={e=>setForm({...form,cta_url:e.target.value})} placeholder="رابط الزر" className="border rounded-xl px-3 py-2.5"/></div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">لون الهوية<input type="color" value={form.accent_color} onChange={e=>setForm({...form,accent_color:e.target.value})} className="w-full h-10 mt-1 border rounded-lg"/></label><label className="text-xs font-bold">لون الخلفية<input type="color" value={form.accent_soft_color} onChange={e=>setForm({...form,accent_soft_color:e.target.value})} className="w-full h-10 mt-1 border rounded-lg"/></label></div>
      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold"><label className="border rounded-xl p-2 cursor-pointer"><ImageIcon className="w-4 h-4 inline ml-1"/>أيقونة<input type="file" accept="image/*" className="hidden" onChange={e=>setIconFile(e.target.files?.[0]||null)}/></label><label className="border rounded-xl p-2 cursor-pointer"><UploadCloud className="w-4 h-4 inline ml-1"/>لوجو<input type="file" accept="image/*" className="hidden" onChange={e=>setLogoFile(e.target.files?.[0]||null)}/></label><label className="border rounded-xl p-2 cursor-pointer"><UploadCloud className="w-4 h-4 inline ml-1"/>بانر<input type="file" accept="image/*" className="hidden" onChange={e=>setBannerFile(e.target.files?.[0]||null)}/></label></div>
      <button disabled={busy} className="w-full bg-slate-950 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2 disabled:opacity-60">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} حفظ وجدولة الموسم</button>
    </form>
    <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">{items.map(item=><div key={item.id} className="border rounded-xl p-3 flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{backgroundColor:item.accent_soft_color||'#f1f5f9'}}><CalendarClock className="w-4 h-4" style={{color:item.accent_color||'#334155'}}/></div><div className="flex-1 min-w-0"><b className="text-xs block truncate">{item.name}</b><span className="text-[10px] text-slate-500">{new Date(item.starts_at).toLocaleDateString('ar-IQ')} — {new Date(item.ends_at).toLocaleDateString('ar-IQ')}</span></div><button type="button" onClick={()=>void toggle(item)} className="p-2 rounded-lg bg-slate-100">{item.is_active?<ToggleRight className="w-4 h-4"/>:<ToggleLeft className="w-4 h-4"/>}</button><button type="button" onClick={()=>void remove(item)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 className="w-4 h-4"/></button></div>)}</div>
  </section>;
};

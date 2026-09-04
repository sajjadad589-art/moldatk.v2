import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (content, from, to, label) => {
  if (!content.includes(from)) {
    console.warn('ads binding skip:', label);
    return content;
  }
  return content.replace(from, to);
};

// Super Admin: publish advertisements directly into Supabase + optional Storage upload.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);

    if (!c.includes('SUPABASE_ADS_BOUND_V1')) {
      c = c.replace(
        "type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n};",
        "type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n  media_url?: string | null;\n  media_type?: 'image' | 'video' | null;\n  action_url?: string | null;\n  priority?: number | null;\n  starts_at?: string | null;\n  ends_at?: string | null;\n  expires_at?: string | null;\n};"
      );

      c = c.replace(
        "  const [notificationForm, setNotificationForm] = useState({\n    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: ''\n  });",
        "  // SUPABASE_ADS_BOUND_V1\n  const [notificationMediaFile, setNotificationMediaFile] = useState<File | null>(null);\n  const [notificationForm, setNotificationForm] = useState({\n    title: '',\n    body: '',\n    category: 'offer',\n    target_type: 'all_generators',\n    generator_id: '',\n    media_url: '',\n    media_type: '',\n    action_url: '',\n    priority: '0',\n    starts_at: localDateTimeValue(),\n    ends_at: '',\n  });"
      );

      const fnStart = c.indexOf('  const sendNotification = async (e: React.FormEvent) => {');
      const fnEnd = c.indexOf('\n  const resetAllDataForRelease = async () => {', fnStart);
      if (fnStart !== -1 && fnEnd !== -1) {
        const newFn = `  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) return setMessage('اكتب عنوان ونص الإعلان');
    if (notificationForm.target_type === 'single_generator' && !notificationForm.generator_id) return setMessage('اختر المولدة المستهدفة');

    try {
      let mediaUrl = notificationForm.media_url.trim() || null;
      let mediaType = (notificationForm.media_type || null) as 'image' | 'video' | null;

      if (notificationMediaFile) {
        const isVideo = notificationMediaFile.type.startsWith('video/');
        const ext = notificationMediaFile.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
        const safeName = notificationMediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const storagePath = \`ads/\${Date.now()}-\${Math.random().toString(16).slice(2)}-\${safeName || 'ad.' + ext}\`;
        const { error: uploadError } = await supabase.storage
          .from('app-ad-media')
          .upload(storagePath, notificationMediaFile, { contentType: notificationMediaFile.type || undefined, upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicFile } = supabase.storage.from('app-ad-media').getPublicUrl(storagePath);
        mediaUrl = publicFile.publicUrl;
        mediaType = isVideo ? 'video' : 'image';
      }

      const startsAt = notificationForm.starts_at ? new Date(notificationForm.starts_at).toISOString() : new Date().toISOString();
      const endsAt = notificationForm.ends_at ? new Date(notificationForm.ends_at).toISOString() : null;
      const { error } = await supabase.from('app_notifications').insert({
        title: notificationForm.title.trim(),
        body: notificationForm.body.trim(),
        category: notificationForm.category || 'offer',
        target_type: notificationForm.target_type,
        generator_id: notificationForm.target_type === 'single_generator' ? notificationForm.generator_id : null,
        is_active: true,
        starts_at: startsAt,
        ends_at: endsAt,
        expires_at: endsAt,
        media_url: mediaUrl,
        media_type: mediaUrl ? mediaType : null,
        action_url: notificationForm.action_url.trim() || null,
        priority: Number(notificationForm.priority || 0),
      } as any);
      if (error) throw error;

      setNotificationMediaFile(null);
      setNotificationForm({ title: '', body: '', category: 'offer', target_type: 'all_generators', generator_id: '', media_url: '', media_type: '', action_url: '', priority: '0', starts_at: localDateTimeValue(), ends_at: '' });
      setMessage('تم ربط الإعلان وحفظه في Supabase وسيظهر داخل إعدادات التطبيق حسب الاستهداف');
      await load();
    } catch (err: any) {
      setMessage(\`تعذر حفظ الإعلان في Supabase: \${err?.message || 'خطأ غير معروف'}\`);
    }
  };
`;
        c = c.slice(0, fnStart) + newFn + c.slice(fnEnd);
      } else {
        console.warn('ads binding skip: sendNotification function');
      }

      c = replaceOnce(
        c,
        "<h2 className=\"text-lg font-black flex items-center gap-2\"><Megaphone className=\"w-5 h-5\" />إرسال إشعار</h2>\n              <p className=\"text-xs text-slate-500 mt-1 mb-5\">صيانة، عروض، أو تحديثات التطبيق</p>",
        "<h2 className=\"text-lg font-black flex items-center gap-2\"><Megaphone className=\"w-5 h-5\" />إعلان داخل التطبيق</h2>\n              <p className=\"text-xs text-slate-500 mt-1 mb-5\">ينحفظ مباشرة في Supabase ويظهر لأصحاب المولدات بالموبايل</p>",
        'notification form title'
      );

      c = replaceOnce(
        c,
        "<textarea rows={5} placeholder=\"نص الإشعار\" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3 resize-none\" />\n              <button className=\"w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2\"><Bell className=\"w-4 h-4\" />نشر الإشعار</button>",
        "<textarea rows={5} placeholder=\"نص الإعلان\" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3 resize-none\" />\n              <label className=\"text-xs font-black text-slate-500\">رفع صورة/فيديو الإعلان إلى Supabase</label>\n              <input type=\"file\" accept=\"image/*,video/mp4,video/webm\" onChange={e => setNotificationMediaFile(e.target.files?.[0] || null)} className=\"w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white text-xs\" />\n              <label className=\"text-xs font-black text-slate-500\">أو رابط صورة/فيديو جاهز</label>\n              <input placeholder=\"https://...\" value={notificationForm.media_url} onChange={e => setNotificationForm(f => ({...f, media_url:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mt-1 mb-3\" />\n              <select value={notificationForm.media_type} onChange={e => setNotificationForm(f => ({...f, media_type:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3 bg-white\"><option value=\"\">تحديد تلقائي/بدون وسائط</option><option value=\"image\">صورة</option><option value=\"video\">فيديو</option></select>\n              <input placeholder=\"رابط عند الضغط على الإعلان - اختياري\" value={notificationForm.action_url} onChange={e => setNotificationForm(f => ({...f, action_url:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3\" />\n              <div className=\"grid grid-cols-3 gap-2 mb-3\"><label className=\"text-xs font-black text-slate-500\">الأولوية<input inputMode=\"numeric\" value={notificationForm.priority} onChange={e => setNotificationForm(f => ({...f, priority:e.target.value.replace(/\\D/g,'')}))} className=\"mt-1 w-full border rounded-xl px-3 py-3\" /></label><label className=\"text-xs font-black text-slate-500 col-span-2\">بداية الظهور<input type=\"datetime-local\" value={notificationForm.starts_at} onChange={e => setNotificationForm(f => ({...f, starts_at:e.target.value}))} className=\"mt-1 w-full border rounded-xl px-3 py-3\" /></label></div>\n              <label className=\"text-xs font-black text-slate-500\">نهاية الظهور - اختياري</label>\n              <input type=\"datetime-local\" value={notificationForm.ends_at} onChange={e => setNotificationForm(f => ({...f, ends_at:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mt-1 mb-3\" />\n              <button className=\"w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2\"><Bell className=\"w-4 h-4\" />حفظ الإعلان في Supabase</button>",
        'ad media fields'
      );

      c = c.replace(
        /<div className=\"divide-y\">\{notifications\.map\(n => <div key=\{n\.id\} className=\"p-5 flex gap-4\">[\s\S]*?<\/div>\)<\/div>/,
        `<div className="divide-y">{notifications.map(n => <div key={n.id} className="p-5 flex gap-4"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{n.category === 'maintenance' ? <Wrench className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</div><div className="flex-1 min-w-0"><div className="flex items-center justify-between"><h3 className="font-black">{n.title}</h3><span className="text-xs text-slate-400">{dateText(n.created_at)}</span></div><p className="text-sm text-slate-600 mt-1 leading-6">{n.body}</p>{n.media_url && n.media_type !== 'video' && <img src={n.media_url} alt="" className="mt-3 h-28 w-full max-w-sm object-cover rounded-xl border" />}{n.media_url && n.media_type === 'video' && <video src={n.media_url} controls className="mt-3 h-28 w-full max-w-sm object-cover rounded-xl border" />}{n.action_url && <p className="text-xs text-blue-700 font-black mt-2 break-all">رابط الإعلان: {n.action_url}</p>}<p className="text-xs text-slate-400 mt-2">إلى: {n.target_type === 'all_generators' ? 'كل أصحاب المولدات' : generatorName(n.generator_id)} — الأولوية: {n.priority ?? 0}</p></div></div>)}</div>`
      );

      write(path, c);
      console.log('Applied Supabase-bound Super Admin advertisements');
    }
  }
}

// Mobile settings: read active advertisements from Supabase and show them in app.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('SUPABASE_MOBILE_ADS_BOUND_V1')) {
      if (!c.includes("from '../../lib/supabase'")) {
        c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
      }
      const block = `
  // SUPABASE_MOBILE_ADS_BOUND_V1
  const [supabaseAds, setSupabaseAds] = React.useState<any[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    const loadSupabaseAds = async () => {
      try {
        const cached = localStorage.getItem('moldatk_supabase_ads');
        if (cached && !cancelled) setSupabaseAds(JSON.parse(cached));
      } catch (e) {}
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_notifications')
          .select('id,title,body,media_url,media_type,action_url,priority,starts_at,ends_at,expires_at,created_at')
          .eq('is_active', true)
          .lte('starts_at', now)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && Array.isArray(data)) {
          const rows = data.filter((ad: any) => (!ad.ends_at || ad.ends_at > now) && (!ad.expires_at || ad.expires_at > now));
          localStorage.setItem('moldatk_supabase_ads', JSON.stringify(rows));
          if (!cancelled) setSupabaseAds(rows);
        }
      } catch (e) {}
    };
    void loadSupabaseAds();
    const timer = window.setInterval(() => void loadSupabaseAds(), 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
`;
      c = c.replace(/\n\}\) => \{\n/, (m) => m + block);
      const insertion = `    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">
      {supabaseAds.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-br from-cyan-700 to-blue-800 p-3.5 shadow-lg overflow-hidden text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><h3 className="text-sm font-black">إعلانات الإدارة</h3></div>
            <span className="text-[10px] font-bold text-white/75">Supabase</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x">
            {supabaseAds.map((ad: any) => (
              <button key={ad.id} type="button" onClick={() => ad.action_url && window.open(ad.action_url, '_blank')} className="min-w-[86%] snap-center text-right rounded-2xl bg-white text-slate-900 p-3 border border-white/40">
                {ad.media_url && ad.media_type !== 'video' && <img src={ad.media_url} alt="" className="w-full h-28 object-cover rounded-xl mb-2" loading="lazy" />}
                {ad.media_url && ad.media_type === 'video' && <video src={ad.media_url} className="w-full h-28 object-cover rounded-xl mb-2" controls preload="metadata" />}
                <strong className="block text-sm font-black">{ad.title}</strong>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-5">{ad.body}</p>
                {ad.action_url && <span className="mt-2 inline-block text-[11px] font-black text-blue-700">فتح الرابط</span>}
              </button>
            ))}
          </div>
        </section>
      )}`;
      c = replaceOnce(c, '    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">', insertion, 'mobile ads insertion');
      write(path, c);
      console.log('Applied Supabase-bound mobile advertisements');
    }
  }
}

console.log('Supabase ads binding applied.');

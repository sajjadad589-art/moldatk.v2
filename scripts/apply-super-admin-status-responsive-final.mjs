import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Super Admin status/responsive finalizer: ${m}`); };

const dashboardPath = 'src/components/SuperAdminDashboard.tsx';
let s = read(dashboardPath);

// Keep the complete seasonal editor as the single seasons UI. The older compact
// SeasonalCampaignManager caused the notification page to overflow and duplicated controls.
s = s.replace(/\nimport \{ SeasonalCampaignManager \} from '\.\/SeasonalCampaignManager';/g, '');
s = s.replace(/\nimport \{ SeasonalCampaignsPanel \} from '\.\/SeasonalCampaignsPanel';/g, '');
s = s.replace(/\nimport \{ AdminAdSlidesPanel \} from '\.\/AdminAdSlidesPanel';/g, '');
const formatterImport = "import { calculateSubscriberBill } from '../utils/formatters';";
must(s.includes(formatterImport), 'formatter import anchor missing');
s = s.replace(formatterImport, `${formatterImport}\nimport { SeasonalCampaignsPanel } from './SeasonalCampaignsPanel';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';`);
s = s.replace(/\s*<SeasonalCampaignManager \/>\s*/g, '\n');

// Status is derived from the latest subscription end time, while an explicit admin
// suspension always wins. This prevents an expired account from remaining visually active.
const statusHelper = `const effectiveGeneratorStatus = (generator: Generator, subscription: Subscription | null, now = new Date()): Generator['status'] => {
  if (generator.status === 'suspended' || subscription?.status === 'suspended') return 'suspended';
  if (!subscription) return 'expired';
  const endMs = new Date(subscription.ends_at).getTime();
  if (!Number.isFinite(endMs)) return generator.status === 'active' ? 'expired' : generator.status;
  if (endMs <= now.getTime() || subscription.status === 'expired') return 'expired';
  return 'active';
};

const subscriptionRemainingText = (subscription: Subscription | null, now = new Date()) => {
  if (!subscription) return 'لا يوجد اشتراك';
  const endMs = new Date(subscription.ends_at).getTime();
  if (!Number.isFinite(endMs)) return 'تاريخ الاشتراك غير صالح';
  const diff = endMs - now.getTime();
  if (diff <= 0) {
    const elapsedDays = Math.max(0, Math.ceil(Math.abs(diff) / 86400000));
    return elapsedDays === 0 ? 'انتهى اليوم' : \`انتهى منذ \${elapsedDays} يوم\`;
  }
  const hours = Math.ceil(diff / 3600000);
  if (hours < 24) return \`متبقي أقل من يوم (\${hours} ساعة)\`;
  const days = Math.ceil(diff / 86400000);
  return \`متبقي \${days} يوم\`;
};`;

const existingStatusStart = s.indexOf('const effectiveGeneratorStatus =');
if (existingStatusStart >= 0) {
  const existingStatusEnd = s.indexOf('\n};', existingStatusStart);
  must(existingStatusEnd > existingStatusStart, 'existing status helper bounds missing');
  let end = existingStatusEnd + 3;
  const remainingStart = s.indexOf('\nconst subscriptionRemainingText =', end);
  if (remainingStart === end) {
    const remainingEnd = s.indexOf('\n};', remainingStart);
    if (remainingEnd > remainingStart) end = remainingEnd + 3;
  }
  s = s.slice(0, existingStatusStart) + statusHelper + s.slice(end);
} else {
  const helperAnchor = "const planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;";
  must(s.includes(helperAnchor), 'status helper insertion anchor missing');
  s = s.replace(helperAnchor, `${helperAnchor}\n${statusHelper}`);
}

// Stats must use the same effective status shown in the account list.
const rawActive = "      active: generators.filter(g => g.status === 'active').length,";
const priorActive = "      active: generators.filter(g => effectiveGeneratorStatus(g, latestSubscriptionFor(g.id), now) === 'active').length,";
const safeActive = "      active: generators.filter(g => { const latest = subscriptions.filter(s => s.generator_id === g.id).sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] || null; return effectiveGeneratorStatus(g, latest, now) === 'active'; }).length,";
if (s.includes(rawActive)) s = s.replace(rawActive, safeActive);
if (s.includes(priorActive)) s = s.replace(priorActive, safeActive);

// Selected account detail uses the same status and displays time remaining.
const selectedAnchor = "  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;";
if (s.includes(selectedAnchor) && !s.includes('const selectedEffectiveStatus =')) {
  s = s.replace(selectedAnchor, `${selectedAnchor}\n  const selectedEffectiveStatus = selectedGenerator ? effectiveGeneratorStatus(selectedGenerator, selectedSubscription) : 'expired';\n  const selectedSubscriptionRemaining = subscriptionRemainingText(selectedSubscription);`);
}

// Replace the owners list as one responsive source of truth. Desktop gets a table, phones get cards.
const generatorsStart = s.indexOf("          {tab === 'generators' &&");
const financeStart = generatorsStart >= 0 ? s.indexOf("\n\n          {tab === 'finance'", generatorsStart) : -1;
must(generatorsStart >= 0 && financeStart > generatorsStart, 'generator section bounds missing');
const generatorSection = `          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {tab === 'generators' && <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><h2 className="text-lg font-black flex items-center gap-2"><Users className="w-5 h-5" />أصحاب المولدات</h2><p className="text-xs text-slate-500 mt-1">الحالة تعتمد على وقت انتهاء الاشتراك الفعلي أو الإيقاف الإداري.</p></div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3"><span className="text-xs text-slate-500">{subscriptions.length} اشتراك مسجل</span><button onClick={() => { setExcelImportProgress(0); setExcelImportReport(EMPTY_EXCEL_REPORT); setExcelImportOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />رفع Excel</button><button onClick={() => setGeneratorOpen(true)} className="bg-blue-700 hover:bg-blue-800 text-white px-3 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />إضافة صاحب مولدة</button></div>
            </div>
            {loading ? <div className="p-10 text-center font-bold text-slate-500">جاري تحميل البيانات...</div> : generators.length === 0 ? <div className="p-14 text-center text-slate-500 font-bold">لا يوجد أصحاب مولدات بعد</div> : <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">اسم المولدة</th><th className="p-4 text-right">صاحب الحساب</th><th className="p-4 text-right">الهاتف</th><th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">ينتهي الاشتراك</th><th className="p-4 text-right">الوقت المتبقي</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الإجراءات</th></tr></thead>
                  <tbody>{generators.map(g => { const sub = latestSubscriptionFor(g.id); const effectiveStatus = effectiveGeneratorStatus(g, sub); const remaining = subscriptionRemainingText(sub); return <tr key={g.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="p-4 font-black">{g.name}</td><td className="p-4">{g.owner_name}</td><td className="p-4">{g.phone || '—'}</td><td className="p-4">{g.area || '—'}</td><td className="p-4 font-bold whitespace-nowrap">{sub ? dateText(sub.ends_at) : '—'}</td><td className={\`p-4 font-black whitespace-nowrap \${effectiveStatus === 'expired' ? 'text-rose-700' : effectiveStatus === 'suspended' ? 'text-amber-700' : 'text-blue-700'}\`}>{remaining}</td><td className="p-4"><span className={\`px-3 py-1.5 rounded-full font-black whitespace-nowrap \${effectiveStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : effectiveStatus === 'suspended' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}\`}>{effectiveStatus === 'active' ? 'فعال' : effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</span></td><td className="p-4"><button onClick={() => setSelectedGeneratorId(g.id)} className="px-3 py-2 rounded-lg bg-slate-900 text-white font-black text-xs inline-flex items-center gap-2"><Eye className="w-4 h-4" />تفاصيل</button></td></tr>})}</tbody>
                </table>
              </div>
              <div className="lg:hidden p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generators.map(g => { const sub = latestSubscriptionFor(g.id); const effectiveStatus = effectiveGeneratorStatus(g, sub); const remaining = subscriptionRemainingText(sub); return <article key={g.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-black text-base truncate">{g.name}</h3><p className="text-xs text-slate-500 mt-1 truncate">{g.owner_name} • {g.phone || 'بدون هاتف'}</p></div><span className={\`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black \${effectiveStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : effectiveStatus === 'suspended' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'}\`}>{effectiveStatus === 'active' ? 'فعال' : effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500 block mb-1">ينتهي</span><b className="block leading-5">{sub ? dateText(sub.ends_at) : '—'}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500 block mb-1">المدة</span><b className={effectiveStatus === 'expired' ? 'text-rose-700' : effectiveStatus === 'suspended' ? 'text-amber-700' : 'text-blue-700'}>{remaining}</b></div></div>
                  <button onClick={() => setSelectedGeneratorId(g.id)} className="mt-3 w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs inline-flex items-center justify-center gap-2"><Eye className="w-4 h-4" />عرض التفاصيل</button>
                </article>})}
              </div>
            </>}
          </section>}`;
s = s.slice(0, generatorsStart) + generatorSection + s.slice(financeStart);

// Replace the old cramped notification grid with a responsive notification center.
const notificationsStart = s.indexOf("          {tab === 'notifications'");
const mainEnd = notificationsStart >= 0 ? s.indexOf('\n        </main>', notificationsStart) : -1;
must(notificationsStart >= 0 && mainEnd > notificationsStart, 'notifications section bounds missing');
const notificationsSection = `          {/* SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2 */}
          {tab === 'notifications' && isOwnerSuperAdmin && <div className="space-y-5 min-w-0">
            <section className="rounded-3xl bg-gradient-to-l from-[#0b1530] via-blue-950 to-slate-900 text-white p-4 sm:p-6 shadow-lg overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><Bell className="w-6 h-6 text-blue-300" />مركز الإشعارات والمناسبات</h2><p className="text-xs sm:text-sm text-slate-300 mt-1">إدارة المواسم، الإعلانات وإشعارات أصحاب المولدات من صفحة واحدة.</p></div><div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-xs font-black">{notifications.length} إشعار منشور</div></div>
            </section>

            <SeasonalCampaignsPanel />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start min-w-0">
              <AdminAdSlidesPanel />

              <form onSubmit={sendNotification} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 h-fit min-w-0">
                <div className="flex items-start gap-3 mb-5"><div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5" /></div><div><h2 className="text-lg font-black">إرسال إشعار</h2><p className="text-xs text-slate-500 mt-1">صيانة، عروض، تحديثات أو إشعار عام</p></div></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-black text-slate-600">نوع الإشعار<select value={notificationForm.category} onChange={e => setNotificationForm(f => ({...f, category:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-3 mt-1 bg-white"><option value="maintenance">صيانة</option><option value="offer">عرض</option><option value="update">تحديث</option><option value="general">عام</option></select></label>
                  <label className="text-xs font-black text-slate-600">المستلمين<select value={notificationForm.target_type} onChange={e => setNotificationForm(f => ({...f, target_type:e.target.value, generator_id:''}))} className="w-full border border-slate-200 rounded-xl px-3 py-3 mt-1 bg-white"><option value="all_generators">كل أصحاب المولدات</option><option value="single_generator">مولدة محددة</option></select></label>
                </div>
                {notificationForm.target_type === 'single_generator' && <label className="block text-xs font-black text-slate-600 mt-3">المولدة المستهدفة<select value={notificationForm.generator_id} onChange={e => setNotificationForm(f => ({...f, generator_id:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-3 mt-1 bg-white"><option value="">اختر المولدة</option>{generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
                <label className="block text-xs font-black text-slate-600 mt-3">عنوان الإشعار<input placeholder="مثال: صيانة مجدولة الليلة" value={notificationForm.title} onChange={e => setNotificationForm(f => ({...f, title:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-3 mt-1" /></label>
                <label className="block text-xs font-black text-slate-600 mt-3">نص الإشعار<textarea rows={5} placeholder="اكتب الرسالة التي ستظهر للمستخدم" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-3 mt-1 resize-y min-h-32" /></label>
                <button className="mt-4 w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" />نشر الإشعار</button>
              </form>
            </div>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
              <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><h2 className="text-lg font-black">سجل الإشعارات</h2><p className="text-xs text-slate-500 mt-1">الإشعارات المنشورة من الإدارة</p></div><span className="text-xs font-black text-slate-400">الأحدث أولاً</span></div>
              {notifications.length === 0 ? <div className="p-10 text-center text-slate-500 font-bold">لا توجد إشعارات بعد</div> : <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">{notifications.map(n => <article key={n.id} className="rounded-2xl border border-slate-200 p-4 flex gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{n.category === 'maintenance' ? <Wrench className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</div><div className="flex-1 min-w-0"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1"><h3 className="font-black break-words">{n.title}</h3><span className="text-[10px] text-slate-400 whitespace-nowrap">{dateText(n.created_at)}</span></div><p className="text-sm text-slate-600 mt-1 leading-6 break-words">{n.body}</p><p className="text-xs text-slate-400 mt-2">إلى: {n.target_type === 'all_generators' ? 'كل أصحاب المولدات' : generatorName(n.generator_id)}</p></div></article>)}</div>}
            </section>
          </div>}`;
s = s.slice(0, notificationsStart) + notificationsSection + s.slice(mainEnd);

// The separate ad panel no longer owns another seasonal editor; the single complete
// SeasonalCampaignsPanel above is the responsive source of truth.
const adPath = 'src/components/AdminAdSlidesPanel.tsx';
let ads = read(adPath);
ads = ads.replace(/\nimport \{ SeasonalCampaignsPanel \} from '\.\/SeasonalCampaignsPanel';/g, '');
ads = ads.replace(/\s*<SeasonalCampaignsPanel \/>\s*/g, '\n');
write(adPath, ads);

// Global Super Admin shell must shrink cleanly on phones instead of forcing a desktop canvas.
s = s.replace("min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] min-w-[1100px]", "min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] min-w-0 w-full overflow-x-hidden");
s = s.replace('h-20 bg-[#0b1530] text-white flex items-center justify-between px-8 shadow-lg', 'min-h-20 bg-[#0b1530] text-white flex items-center justify-between px-3 sm:px-5 lg:px-8 py-3 shadow-lg flex-wrap gap-3');
s = s.replace('className="flex max-w-[1700px] mx-auto"', 'className="flex flex-col lg:flex-row max-w-[1700px] mx-auto w-full min-w-0"');
s = s.replace('className="w-64 p-5 shrink-0"', 'className="w-full lg:w-64 p-3 sm:p-5 shrink-0"');
s = s.replace('className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm sticky top-5"', 'className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm lg:sticky lg:top-5 flex lg:block gap-2 overflow-x-auto"');
s = s.replace('className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black mb-1 ${tab === key ?', 'className={`w-auto lg:w-full shrink-0 flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 rounded-xl text-sm font-black lg:mb-1 whitespace-nowrap ${tab === key ?');
s = s.replace('className="p-5 pl-8 flex-1 min-w-0"', 'className="p-3 sm:p-5 lg:pl-8 flex-1 min-w-0 w-full"');

// Ensure the selected account detail uses effective status rather than raw DB status.
const oldSelectedStatus = /<div className=\{`rounded-2xl p-4 \$\{selectedGenerator\.status === 'suspended'[\s\S]*?<\/div>/;
if (oldSelectedStatus.test(s)) {
  s = s.replace(oldSelectedStatus, `<div className={\`rounded-2xl p-4 \${selectedEffectiveStatus === 'active' ? 'bg-emerald-50' : selectedEffectiveStatus === 'suspended' ? 'bg-amber-50' : 'bg-rose-50'}\`}><p className={\`text-xs font-bold \${selectedEffectiveStatus === 'active' ? 'text-emerald-700' : selectedEffectiveStatus === 'suspended' ? 'text-amber-700' : 'text-rose-700'}\`}>حالة الاشتراك</p><p className="font-black mt-1">{selectedEffectiveStatus === 'active' ? 'فعال' : selectedEffectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</p><p className="text-xs mt-1 text-slate-600 font-bold">{selectedSubscriptionRemaining}</p></div>`);
}

// Final release identity. This pass runs after the legacy 1.3.26 normalizer on every lint/build.
for (const path of ['public/sw.js', 'src/main.tsx', 'public/pwa-recovery-v6.js']) {
  if (!fs.existsSync(path)) continue;
  write(path, read(path).replaceAll('1.3.26', '1.3.27'));
}
{
  const path = 'android/app/build.gradle';
  let gradle = read(path);
  gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 31');
  gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "1.3.27"');
  write(path, gradle);
}

write(dashboardPath, s);

const out = read(dashboardPath);
must(out.includes('SUPER_ADMIN_SUBSCRIPTION_STATUS_V2'), 'subscription status UI marker missing');
must(out.includes("effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'"), 'effective status labels missing');
must(out.includes('subscriptionRemainingText(sub)'), 'remaining subscription time missing');
must(out.includes('SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2'), 'responsive notification center missing');
must(out.includes('<SeasonalCampaignsPanel />'), 'complete seasonal campaigns panel missing');
must(out.includes('<AdminAdSlidesPanel />'), 'ad panel missing');
must(!out.includes('<SeasonalCampaignManager />'), 'legacy seasonal manager still rendered');
must(!out.includes('min-w-[1100px]'), 'forced desktop minimum width remains');
must(!read(adPath).includes('<SeasonalCampaignsPanel />'), 'duplicate seasonal editor remains inside ad panel');
must(read('android/app/build.gradle').includes('versionCode 31'), 'Android versionCode 31 missing');
must(read('android/app/build.gradle').includes('versionName "1.3.27"'), 'Android versionName 1.3.27 missing');
must(read('public/sw.js').includes('moldatk-shell-v4-1.3.27'), '1.3.27 service worker marker missing');
must(read('src/main.tsx').includes('/sw.js?v=1.3.27'), '1.3.27 service worker registration missing');

console.log('Super Admin final UI: effective subscription status + remaining time, responsive seasons/notifications, and release 1.3.27/code31 applied.');

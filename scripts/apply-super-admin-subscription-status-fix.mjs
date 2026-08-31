import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const helperMarker = "const planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;";
const helper = `${helperMarker}\nconst effectiveGeneratorStatus = (generator: Generator, subscription: Subscription | null, now = new Date()): Generator['status'] => {\n  if (generator.status === 'suspended') return 'suspended';\n  if (!subscription) return generator.status === 'active' ? 'expired' : generator.status;\n  const end = new Date(subscription.ends_at);\n  if (!Number.isFinite(end.getTime())) return generator.status;\n  if (end.getTime() <= now.getTime() || subscription.status === 'expired') return 'expired';\n  return 'active';\n};`;
if (!source.includes('const effectiveGeneratorStatus =')) {
  if (!source.includes(helperMarker)) throw new Error('Status helper marker not found');
  source = source.replace(helperMarker, helper);
  changed = true;
}

const oldEffect = "  useEffect(() => { void load(); }, []);";
const newEffect = `  useEffect(() => {\n    void load();\n    const timer = window.setInterval(() => {\n      setSubscriptions(current => [...current]);\n    }, 60 * 1000);\n    return () => window.clearInterval(timer);\n  }, []);`;
if (source.includes(oldEffect)) {
  source = source.replace(oldEffect, newEffect);
  changed = true;
}

const oldActive = "      active: generators.filter(g => g.status === 'active').length,";
const newActive = "      active: generators.filter(g => effectiveGeneratorStatus(g, latestSubscriptionFor(g.id), now) === 'active').length,";
if (source.includes(oldActive)) {
  source = source.replace(oldActive, newActive);
  changed = true;
}

const oldRow = "<table className=\"w-full text-sm\"><thead className=\"bg-slate-50 text-slate-500\"><tr><th className=\"p-4 text-right\">اسم المولدة</th><th className=\"p-4 text-right\">صاحب الحساب</th><th className=\"p-4 text-right\">الهاتف</th><th className=\"p-4 text-right\">المنطقة</th><th className=\"p-4 text-right\">ينتهي الاشتراك</th><th className=\"p-4 text-right\">الحالة</th><th className=\"p-4 text-right\">الإجراءات</th></tr></thead><tbody>{generators.map(g => { const sub = latestSubscriptionFor(g.id); return <tr key={g.id} className=\"border-t border-slate-100\"><td className=\"p-4 font-black\">{g.name}</td><td className=\"p-4\">{g.owner_name}</td><td className=\"p-4\">{g.phone || '—'}</td><td className=\"p-4\">{g.area || '—'}</td><td className=\"p-4 font-bold\">{sub ? dateText(sub.ends_at) : '—'}</td><td className=\"p-4\"><span className={`px-2.5 py-1 rounded-lg font-bold ${g.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{g.status === 'active' ? 'فعال' : g.status === 'suspended' ? 'موقوف' : 'منتهي'}</span></td><td className=\"p-4\"><button onClick={() => setSelectedGeneratorId(g.id)} className=\"px-3 py-2 rounded-lg bg-slate-900 text-white font-black text-xs inline-flex items-center gap-2\"><Eye className=\"w-4 h-4\" />تفاصيل</button></td></tr>})}</tbody></table>";
const newRow = "<table className=\"w-full text-sm\"><thead className=\"bg-slate-50 text-slate-500\"><tr><th className=\"p-4 text-right\">اسم المولدة</th><th className=\"p-4 text-right\">صاحب الحساب</th><th className=\"p-4 text-right\">الهاتف</th><th className=\"p-4 text-right\">المنطقة</th><th className=\"p-4 text-right\">ينتهي الاشتراك</th><th className=\"p-4 text-right\">الحالة</th><th className=\"p-4 text-right\">الإجراءات</th></tr></thead><tbody>{generators.map(g => { const sub = latestSubscriptionFor(g.id); const effectiveStatus = effectiveGeneratorStatus(g, sub); return <tr key={g.id} className=\"border-t border-slate-100\"><td className=\"p-4 font-black\">{g.name}</td><td className=\"p-4\">{g.owner_name}</td><td className=\"p-4\">{g.phone || '—'}</td><td className=\"p-4\">{g.area || '—'}</td><td className=\"p-4 font-bold\">{sub ? dateText(sub.ends_at) : '—'}</td><td className=\"p-4\"><span className={`px-2.5 py-1 rounded-lg font-bold ${effectiveStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : effectiveStatus === 'suspended' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{effectiveStatus === 'active' ? 'فعال' : effectiveStatus === 'suspended' ? 'موقوف' : 'منتهي'}</span></td><td className=\"p-4\"><button onClick={() => setSelectedGeneratorId(g.id)} className=\"px-3 py-2 rounded-lg bg-slate-900 text-white font-black text-xs inline-flex items-center gap-2\"><Eye className=\"w-4 h-4\" />تفاصيل</button></td></tr>})}</tbody></table>";
if (source.includes(oldRow)) {
  source = source.replace(oldRow, newRow);
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Applied super admin effective subscription status fix');
} else {
  console.log('Super admin subscription status fix already applied');
}

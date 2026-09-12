import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let s = fs.readFileSync(path, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Responsive subscriber count preserve: ${m}`); };

must(s.includes('SUPER_ADMIN_SUBSCRIPTION_STATUS_V2'), 'responsive owners section missing');

if (!s.includes('<th className="p-4 text-right">عدد المشتركين</th>')) {
  const header = '<th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">ينتهي الاشتراك</th>';
  must(s.includes(header), 'desktop subscriber count header anchor missing');
  s = s.replace(header, '<th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">عدد المشتركين</th><th className="p-4 text-right">ينتهي الاشتراك</th>');
}

if (!s.includes('{subscriberCounts[g.id] || 0}')) {
  const cell = '<td className="p-4">{g.area || \'—\'}</td><td className="p-4 font-bold whitespace-nowrap">{sub ? dateText(sub.ends_at) : \'—\'}</td>';
  must(s.includes(cell), 'desktop subscriber count cell anchor missing');
  s = s.replace(cell, '<td className="p-4">{g.area || \'—\'}</td><td className="p-4 font-black">{subscriberCounts[g.id] || 0}</td><td className="p-4 font-bold whitespace-nowrap">{sub ? dateText(sub.ends_at) : \'—\'}</td>');
}

const mobileIdentity = "<p className=\"text-xs text-slate-500 mt-1 truncate\">{g.owner_name} • {g.phone || 'بدون هاتف'}</p>";
if (s.includes(mobileIdentity) && !s.includes("{g.owner_name} • {g.phone || 'بدون هاتف'} • {subscriberCounts[g.id] || 0} مشترك")) {
  s = s.replace(mobileIdentity, "<p className=\"text-xs text-slate-500 mt-1 truncate\">{g.owner_name} • {g.phone || 'بدون هاتف'} • {subscriberCounts[g.id] || 0} مشترك</p>");
}

must(s.includes('<th className="p-4 text-right">عدد المشتركين</th>'), 'subscriber count desktop header missing');
must(s.includes('{subscriberCounts[g.id] || 0}'), 'subscriber count value missing');
fs.writeFileSync(path, s, 'utf8');
console.log('Responsive Super Admin owners list preserved per-generator subscriber counts.');

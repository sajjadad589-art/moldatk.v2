import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let text = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-balanced-stats-v1';

if (text.includes(marker)) {
  console.log('Super Admin balanced stats already applied');
  process.exit(0);
}

const oldBlock = `          {tab === 'overview' && <>
            <div className="grid grid-cols-4 gap-5 mb-5">
              {[
                ['إجمالي أصحاب المولدات', stats.total, Building2],
                ['الحسابات الفعالة', stats.active, ShieldCheck],
                ['تنتهي خلال 7 أيام', stats.expiring, CalendarClock],
                ['إيراد هذا الشهر', iqd(stats.monthRevenue), WalletCards],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div><p className="text-sm text-slate-500 font-bold">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-6 h-6 text-blue-700" /></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إجمالي المستحصل</p><p className="text-3xl font-black mt-3">{iqd(stats.allRevenue)}</p></div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إيراد السنة</p><p className="text-3xl font-black mt-3">{iqd(stats.yearRevenue)}</p></div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إشعارات منشورة</p><p className="text-3xl font-black mt-3">{notifications.length}</p></div>
            </div>
          </>}`;

const newBlock = `          {/* ${marker} */}
          {tab === 'overview' && <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                ['إجمالي أصحاب المولدات', stats.total, Building2],
                ['الحسابات الفعالة', stats.active, ShieldCheck],
                ['تنتهي خلال 7 أيام', stats.expiring, CalendarClock],
                ['إيراد هذا الشهر', iqd(stats.monthRevenue), WalletCards],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="min-h-[132px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] leading-5 text-slate-500 font-black max-w-[145px]">{label}</p>
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center"><Icon className="w-5 h-5 text-blue-700" /></div>
                  </div>
                  <p className="text-2xl leading-none font-black mt-4 whitespace-nowrap">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                ['إجمالي المستحصل', iqd(stats.allRevenue), CircleDollarSign],
                ['إيراد السنة', iqd(stats.yearRevenue), WalletCards],
                ['إشعارات منشورة', notifications.length, Bell],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="min-h-[124px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 overflow-hidden">
                  <div className="min-w-0"><p className="text-sm text-slate-500 font-black">{label}</p><p className="text-2xl font-black mt-3 whitespace-nowrap">{value}</p></div>
                  <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-5 h-5 text-blue-700" /></div>
                </div>
              ))}
            </div>
          </>}`;

if (!text.includes(oldBlock)) {
  console.warn('Skip Super Admin stats layout: overview block not found');
  process.exit(0);
}

text = text.replace(oldBlock, newBlock);
fs.writeFileSync(file, text);
console.log('Applied balanced Super Admin overview stats layout');

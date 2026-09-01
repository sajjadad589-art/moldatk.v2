import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let source = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-mobile-generator-cards-v3';

if (source.includes(marker)) {
  console.log('Super Admin mobile generator cards v3 already applied');
  process.exit(0);
}

const tabStart = source.indexOf("{tab === 'generators' &&");
const financeStart = source.indexOf("{tab === 'finance'", tabStart);
if (tabStart < 0 || financeStart < 0) throw new Error('Could not locate generators tab');

let section = source.slice(tabStart, financeStart);
const tableStart = section.indexOf('<table');
const tableClose = section.indexOf('</table>', tableStart);
if (tableStart < 0 || tableClose < 0) throw new Error('Could not locate generators table');

const tableOnly = section.slice(tableStart, tableClose + '</table>'.length);
const beforeTable = section.slice(0, tableStart);
const afterTable = section.slice(tableClose + '</table>'.length);

// The original table sits inside the final arm of a ternary:
// loading ? ... : generators.length === 0 ? ... : <table>...</table>}
// Remove only the single brace that closes that ternary expression, preserving all surrounding JSX.
const ternaryClose = afterTable.match(/^\s*}/);
if (!ternaryClose) throw new Error('Could not locate generators table ternary close');
const remainder = afterTable.slice(ternaryClose[0].length);

const mobileAndDesktop = `<>
              {/* ${marker} */}
              <div className="md:hidden space-y-3 p-3 bg-slate-50">
                {generators.map(g => {
                  const sub = latestSubscriptionFor(g.id);
                  const statusLabel = g.status === 'active' ? 'فعال' : g.status === 'suspended' ? 'موقوف' : 'منتهي';
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGeneratorId(g.id)}
                      className="w-full text-right bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-[15px] text-slate-900 truncate max-w-[170px]">{g.name}</h3>
                            <span className={\`px-2 py-0.5 rounded-full text-[10px] font-black \${g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : g.status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}\`}>{statusLabel}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 truncate">{g.owner_name}</p>
                        </div>
                        <span className="shrink-0 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-black">تفاصيل</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">الهاتف</span><p className="font-bold text-slate-700 truncate mt-0.5" dir="ltr">{g.phone || '—'}</p></div>
                        <div className="rounded-xl bg-slate-50 p-2.5"><span className="text-[10px] text-slate-400">المشتركين</span><p className="font-black text-slate-800 mt-0.5">{subscriberCounts[g.id] || 0}</p></div>
                        <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">المنطقة</span><p className="font-bold text-slate-700 truncate mt-0.5">{g.area || '—'}</p></div>
                        <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">انتهاء الاشتراك</span><p className="font-bold text-slate-700 truncate mt-0.5">{sub ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'short' }).format(new Date(sub.ends_at)) : '—'}</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">${tableOnly}</div>
            </>}`;

section = beforeTable + mobileAndDesktop + '}' + remainder;
source = source.slice(0, tabStart) + section + source.slice(financeStart);
fs.writeFileSync(file, source);
console.log('Applied compact Super Admin mobile generator cards v3');

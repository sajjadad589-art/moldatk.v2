import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let source = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-mobile-generator-cards-v1';

if (source.includes(marker)) {
  console.log('Super Admin mobile generator cards already applied');
  process.exit(0);
}

const tabStart = source.indexOf("{tab === 'generators' &&");
const financeStart = source.indexOf("{tab === 'finance'", tabStart);
if (tabStart < 0 || financeStart < 0) throw new Error('Could not locate generators tab');

let section = source.slice(tabStart, financeStart);
const tableStart = section.indexOf('<table className="w-full text-sm">');
const tableEndToken = '</table>}';
const tableEnd = section.indexOf(tableEndToken, tableStart);
if (tableStart < 0 || tableEnd < 0) throw new Error('Could not locate generators table');

const oldTable = section.slice(tableStart, tableEnd + tableEndToken.length);
const tableOnly = oldTable.slice(0, -1); // keep table, remove closing ternary brace

const mobileCards = `{/* ${marker} */}
              <div className="md:hidden divide-y divide-slate-100">
                {generators.map(g => {
                  const sub = latestSubscriptionFor(g.id);
                  const statusLabel = g.status === 'active' ? 'فعال' : g.status === 'suspended' ? 'موقوف' : 'منتهي';
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGeneratorId(g.id)}
                      className="w-full text-right p-4 bg-white active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-[15px] text-slate-900 truncate max-w-[180px]">{g.name}</h3>
                            <span className={\`px-2 py-0.5 rounded-full text-[10px] font-black \${g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : g.status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}\`}>{statusLabel}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 truncate">{g.owner_name}</p>
                        </div>
                        <span className="shrink-0 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black">تعديل / حالة</span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-xs">
                        <div className="min-w-0"><span className="text-slate-400">الهاتف</span><p className="font-bold text-slate-700 truncate" dir="ltr">{g.phone || '—'}</p></div>
                        <div><span className="text-slate-400">المشتركين</span><p className="font-black text-slate-800">{subscriberCounts[g.id] || 0}</p></div>
                        <div className="min-w-0"><span className="text-slate-400">المنطقة</span><p className="font-bold text-slate-700 truncate">{g.area || '—'}</p></div>
                        <div className="min-w-0"><span className="text-slate-400">انتهاء الاشتراك</span><p className="font-bold text-slate-700 truncate">{sub ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'short' }).format(new Date(sub.ends_at)) : '—'}</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">${tableOnly}</div>}`;

section = section.slice(0, tableStart) + mobileCards + section.slice(tableEnd + tableEndToken.length);
source = source.slice(0, tabStart) + section + source.slice(financeStart);
fs.writeFileSync(file, source);
console.log('Applied compact Super Admin mobile generator cards v1');

import fs from 'node:fs';

const path = 'src/components/POSQuickView.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const replacements = [
  [
    'className="flex items-center justify-between p-3 rounded-2xl bg-[#101b35] border border-emerald-500/25 hover:border-emerald-500/50 cursor-pointer transition-all"',
    'className="flex items-center justify-between p-3 rounded-2xl bg-emerald-700 border-2 border-emerald-400 hover:bg-emerald-600 cursor-pointer transition-all shadow-md"'
  ],
  [
    '<span className="text-[10px] text-slate-400">{lineObj?.name || \'الخط الرئيسي\'} • {sub.amperes} أمبير</span>',
    '<span className="text-[10px] text-emerald-50">{lineObj?.name || \'الخط الرئيسي\'} • {sub.amperes} أمبير</span>'
  ],
  [
    '<span className="text-xs font-bold text-emerald-400">تم التسديد</span>',
    '<span className="text-xs font-black text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">مسدد</span>'
  ],
  [
    'className="relative overflow-hidden flex items-center justify-between p-4.5 rounded-3xl bg-[#101b35] border border-blue-900/40 shadow-lg hover:border-blue-500/80 hover:bg-[#152342] transition-all cursor-pointer group"',
    'className={`relative overflow-hidden flex items-center justify-between p-4.5 rounded-3xl border-2 shadow-lg transition-all cursor-pointer group ${sub.paymentStatus === \'partial\' ? \'bg-amber-600 border-amber-300 hover:bg-amber-500\' : sub.paymentStatus === \'free\' ? \'bg-violet-600 border-violet-300 hover:bg-violet-500\' : \'bg-rose-700 border-rose-300 hover:bg-rose-600\'}`}'
  ],
  [
    '<div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500 rounded-l" />',
    '<div className={`absolute right-0 top-0 bottom-0 w-2 ${sub.paymentStatus === \'partial\' ? \'bg-amber-200\' : sub.paymentStatus === \'free\' ? \'bg-violet-200\' : \'bg-rose-200\'}`} />'
  ],
  [
    '<span className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">{sub.fullName}</span>',
    '<span className="text-sm font-black text-white transition-colors">{sub.fullName}</span>'
  ],
  [
    '<div className="flex items-center gap-3 text-xs text-slate-400">',
    '<div className="flex items-center gap-3 text-xs text-white/90">'
  ],
  [
    '<span className="text-sm font-black text-amber-400 tabular-nums" dir="ltr">',
    '<span className="text-sm font-black text-white tabular-nums" dir="ltr">'
  ]
];

for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
    changed = true;
  }
}

const dueAmountMarker = `                    <span className="text-sm font-black text-white tabular-nums" dir="ltr">
                      {dueAmount.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
                    </span>`;

if (source.includes(dueAmountMarker) && !source.includes("sub.paymentStatus === 'partial' ? 'جزئي'")) {
  source = source.replace(
    dueAmountMarker,
    `                    <div className="flex flex-col items-end gap-1.5">
                      <span className={\`px-3 py-1 rounded-xl text-[10px] font-black border bg-white $\{sub.paymentStatus === 'partial' ? 'text-amber-700 border-amber-200' : sub.paymentStatus === 'free' ? 'text-violet-700 border-violet-200' : 'text-rose-700 border-rose-200'\`}>
                        {sub.paymentStatus === 'partial' ? 'جزئي' : sub.paymentStatus === 'free' ? 'مجاني' : 'غير مسدد'}
                      </span>
                      <span className="text-sm font-black text-white tabular-nums" dir="ltr">
                        {dueAmount.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
                      </span>
                    </div>`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Applied solid subscriber payment status colors');
} else {
  console.log('Solid subscriber payment status colors already applied');
}

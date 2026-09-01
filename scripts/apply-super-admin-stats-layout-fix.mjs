import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let text = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-balanced-stats-v4';

if (text.includes(marker)) {
  console.log('Super Admin balanced stats v4 already applied');
  process.exit(0);
}

const overviewStart = text.indexOf("{tab === 'overview' && <>");
const generatorsStart = text.indexOf("{tab === 'generators'", overviewStart);
if (overviewStart < 0 || generatorsStart < 0) {
  console.warn('Skip Super Admin stats layout v4: overview section not found');
  process.exit(0);
}

let section = text.slice(overviewStart, generatorsStart);
const originalSection = section;

section = section.replace(
  "{tab === 'overview' && <>",
  `{/* ${marker} */}\n          {tab === 'overview' && <>`
);

// Main issue: five dashboard cards were squeezed into one phone row.
// Force a responsive layout: 2 columns on phones, 3 on tablets, 5 on desktop.
section = section.replace(
  /className="grid[^\"]*mb-[^\s\"]+"/,
  'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4"'
);

// Make each metric card readable and evenly sized on narrow screens.
section = section.replace(
  /className="(?:min-h-\[[^\]]+\]\s+)?bg-white border border-slate-200 rounded-2xl p-[45] shadow-sm flex(?: flex-col)?(?: items-center)? justify-between[^\"]*"/,
  'className="min-h-[116px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between overflow-hidden last:col-span-2 sm:last:col-span-1"'
);

section = section.replace(
  /<div(?: className="min-w-0")?><p className="text-(?:xs|sm)[^"]*text-slate-500 font-(?:bold|black)">\{label\}<\/p><p className="text-(?:xl|2xl)[^"]*font-black[^\"]*">\{value\}<\/p><\/div>/,
  '<div className="min-w-0"><p className="text-xs sm:text-sm leading-5 text-slate-500 font-black">{label}</p><p className="text-xl sm:text-2xl leading-none font-black mt-3 whitespace-nowrap">{value}</p></div>'
);

section = section.replace(
  /<div className="w-(?:9|10|11|12) h-(?:9|10|11|12)[^"]*"><Icon className="w-(?:5|6) h-(?:5|6) text-blue-700" \/><\/div>/,
  '<div className="w-9 h-9 mt-3 rounded-xl bg-blue-50 flex items-center justify-center self-end shrink-0"><Icon className="w-5 h-5 text-blue-700" /></div>'
);

// Best-effort cleanup for the lower three cards. Do not block the build if another patch changed them.
section = section.replace(
  /className="grid grid-cols-3 gap-(?:3|4|5)"/,
  'className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"'
);
section = section.replaceAll(
  'className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"',
  'className="min-h-[108px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center"'
);
section = section.replaceAll(
  'className="text-3xl font-black mt-3"',
  'className="text-2xl sm:text-3xl font-black mt-3 whitespace-nowrap"'
);

if (!section.includes('grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5')) {
  console.warn('Skip Super Admin stats layout v4: top stats grid pattern changed');
  process.exit(0);
}

text = text.slice(0, overviewStart) + section + text.slice(generatorsStart);
fs.writeFileSync(file, text);
console.log(`Applied balanced Super Admin overview stats layout v4${section !== originalSection ? '' : ' (no-op)'}`);

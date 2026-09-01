import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let text = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-balanced-stats-v3';

if (text.includes(marker)) {
  console.log('Super Admin balanced stats v3 already applied');
  process.exit(0);
}

const overviewStart = text.indexOf("{tab === 'overview' && <>");
const generatorsStart = text.indexOf("{tab === 'generators'", overviewStart);
if (overviewStart < 0 || generatorsStart < 0) {
  throw new Error('Could not locate Super Admin overview section');
}

let section = text.slice(overviewStart, generatorsStart);
let changes = 0;

section = section.replace(
  "{tab === 'overview' && <>",
  `{/* ${marker} */}\n          {tab === 'overview' && <>`
);
changes++;

// Top overview stats: two columns on phones, three on small tablets, five on desktop.
section = section.replace(
  /className="grid[^\"]*mb-[^\s\"]+"/,
  'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4"'
);
changes++;

section = section.replace(
  /className="(?:min-h-\[[^\]]+\]\s+)?bg-white border border-slate-200 rounded-2xl p-[45] shadow-sm flex(?: flex-col)?(?: items-center)? justify-between(?: overflow-hidden)?(?: last:col-span-2 sm:last:col-span-1)?"/,
  'className="min-h-[116px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between overflow-hidden last:col-span-2 sm:last:col-span-1"'
);
changes++;

section = section.replace(
  /<div(?: className="min-w-0")?><p className="text-(?:xs|sm)[^"]*text-slate-500 font-(?:bold|black)">\{label\}<\/p><p className="text-(?:xl|2xl)[^"]*font-black[^\"]*">\{value\}<\/p><\/div>/,
  '<div className="min-w-0"><p className="text-xs sm:text-sm leading-5 text-slate-500 font-black">{label}</p><p className="text-xl sm:text-2xl leading-none font-black mt-3 whitespace-nowrap">{value}</p></div>'
);

section = section.replace(
  /<div className="w-(?:9|12) h-(?:9|12)[^"]*"><Icon className="w-(?:5|6) h-(?:5|6) text-blue-700" \/><\/div>/,
  '<div className="w-9 h-9 mt-3 rounded-xl bg-blue-50 flex items-center justify-center self-end"><Icon className="w-5 h-5 text-blue-700" /></div>'
);

// Bottom overview cards: one column on phones, three on wider screens.
section = section.replace(
  /className="grid grid-cols-3 gap-(?:4|5)"/,
  'className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"'
);
section = section.replace(
  /className="grid grid-cols-1 sm:grid-cols-3 gap-(?:3|4)(?: sm:gap-4)?"/,
  'className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"'
);
changes++;

section = section.replaceAll(
  'className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"',
  'className="min-h-[108px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center"'
);
section = section.replaceAll(
  'className="text-3xl font-black mt-3"',
  'className="text-2xl sm:text-3xl font-black mt-3 whitespace-nowrap"'
);

if (!section.includes('grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5')) {
  throw new Error('Top Super Admin stats grid was not patched');
}
if (!section.includes('grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4')) {
  throw new Error('Bottom Super Admin stats grid was not patched');
}

text = text.slice(0, overviewStart) + section + text.slice(generatorsStart);
fs.writeFileSync(file, text);
console.log(`Applied balanced Super Admin overview stats layout v3 (${changes} structural changes)`);

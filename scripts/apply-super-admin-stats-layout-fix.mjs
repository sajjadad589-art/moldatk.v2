import fs from 'node:fs';

const file = 'src/components/SuperAdminDashboard.tsx';
let text = fs.readFileSync(file, 'utf8');
const marker = 'super-admin-balanced-stats-v2';

if (text.includes(marker)) {
  console.log('Super Admin balanced stats v2 already applied');
  process.exit(0);
}

const overviewStart = text.indexOf("{tab === 'overview' && <>");
const generatorsStart = text.indexOf("{tab === 'generators'", overviewStart);
if (overviewStart < 0 || generatorsStart < 0) {
  throw new Error('Could not locate Super Admin overview section');
}

let section = text.slice(overviewStart, generatorsStart);
let changes = 0;

// Add an idempotency marker directly into the overview fragment.
section = section.replace(
  "{tab === 'overview' && <>",
  `{/* ${marker} */}\n          {tab === 'overview' && <>`
);
changes++;

// Five overview metrics are added by the subscriber-count patch before this script runs.
// On phones use two roomy columns instead of five squeezed columns.
section = section.replace(
  /className="grid(?:\s+grid-cols-[^\s\"]+)?(?:\s+sm:grid-cols-[^\s\"]+)?(?:\s+md:grid-cols-[^\s\"]+)?(?:\s+lg:grid-cols-[^\s\"]+)?(?:\s+xl:grid-cols-[^\s\"]+)?\s+gap-[^\s\"]+\s+mb-[^\s\"]+"/,
  'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4"'
);
changes++;

// Top metric card: vertical layout keeps label/value readable at small widths.
section = section.replace(
  /className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between"/,
  'className="min-h-[116px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between overflow-hidden last:col-span-2 sm:last:col-span-1"'
);
changes++;

section = section.replace(
  '<div><p className="text-sm text-slate-500 font-bold">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>',
  '<div className="min-w-0"><p className="text-xs sm:text-sm leading-5 text-slate-500 font-black">{label}</p><p className="text-xl sm:text-2xl leading-none font-black mt-3 whitespace-nowrap">{value}</p></div>'
);
changes++;

section = section.replace(
  '<div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-6 h-6 text-blue-700" /></div>',
  '<div className="w-9 h-9 mt-3 rounded-xl bg-blue-50 flex items-center justify-center self-end"><Icon className="w-5 h-5 text-blue-700" /></div>'
);
changes++;

// Bottom cards should stack on a phone and become three equal cards on wider screens.
section = section.replace(
  'className="grid grid-cols-3 gap-5"',
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
if (!section.includes('grid grid-cols-1 sm:grid-cols-3')) {
  throw new Error('Bottom Super Admin stats grid was not patched');
}

text = text.slice(0, overviewStart) + section + text.slice(generatorsStart);
fs.writeFileSync(file, text);
console.log(`Applied balanced Super Admin overview stats layout v2 (${changes} structural changes)`);

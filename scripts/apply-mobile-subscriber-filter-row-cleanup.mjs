import fs from 'node:fs';

const file = 'src/components/mobile/MobileSubscribers.tsx';
let source = fs.readFileSync(file, 'utf8');
let changed = false;

const legendStartMarker = '        {/* Color Legend for Mobile */}';
const filterMarker = '        {/* Filter Pills */}';
const legendStart = source.indexOf(legendStartMarker);
const filterStart = source.indexOf(filterMarker, legendStart >= 0 ? legendStart : 0);

if (legendStart >= 0 && filterStart > legendStart) {
  source = source.slice(0, legendStart) + source.slice(filterStart);
  changed = true;
}

const filterBlockStart = source.indexOf(filterMarker);
const filterBlockEndMarker = '      </div>\n\n      {/* 2. Subscribers Cards List */}';
const filterBlockEnd = filterBlockStart >= 0 ? source.indexOf(filterBlockEndMarker, filterBlockStart) : -1;

if (filterBlockStart >= 0 && filterBlockEnd > filterBlockStart) {
  let block = source.slice(filterBlockStart, filterBlockEnd);
  const originalBlock = block;

  block = block.replace(
    'className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"',
    'className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5"'
  );
  block = block.replaceAll(
    'px-3 py-1.5 rounded-xl text-xs font-bold',
    'px-4 py-2.5 rounded-2xl text-sm font-black'
  );
  block = block.replaceAll('w-1.5 h-1.5 rounded-full', 'w-2 h-2 rounded-full');

  if (block !== originalBlock) {
    source = source.slice(0, filterBlockStart) + block + source.slice(filterBlockEnd);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(file, source);
  console.log('Removed mobile subscriber color legend and enlarged status filters');
} else {
  console.log('Mobile subscriber legend/filter cleanup already applied');
}

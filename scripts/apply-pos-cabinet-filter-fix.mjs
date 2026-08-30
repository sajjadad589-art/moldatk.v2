import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'src/components/POSQuickView.tsx');
let source = fs.readFileSync(filePath, 'utf8');
let changed = false;

const oldFilter = `  const filteredSubs = subscribers.filter(sub => {
    if (selectedLineFilter !== 'all' && sub.lineId !== selectedLineFilter) return false;
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchName = sub.fullName.toLowerCase().includes(query);
      const matchPhone = sub.phone?.toLowerCase().includes(query);
      const matchCode = sub.subscriberCode?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
    return true;
  });`;

const newFilter = `  const normalizeLineKey = (value?: string | null) => String(value || '').trim().toLowerCase();

  const filteredSubs = subscribers.filter(sub => {
    if (selectedLineFilter !== 'all') {
      const selectedLine = lines.find(line => line.id === selectedLineFilter);
      const wantedId = normalizeLineKey(selectedLineFilter);
      const wantedName = normalizeLineKey(selectedLine?.name);
      const subLineId = normalizeLineKey(sub.lineId);
      const subLineName = normalizeLineKey(sub.lineName || sub.line);
      const matchesLine =
        subLineId === wantedId ||
        (!!wantedName && subLineName === wantedName) ||
        (!!wantedName && subLineId === wantedName) ||
        (!!wantedId && subLineName === wantedId);

      if (!matchesLine) return false;
    }
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchName = sub.fullName.toLowerCase().includes(query);
      const matchPhone = sub.phone?.toLowerCase().includes(query);
      const matchCode = sub.subscriberCode?.toLowerCase().includes(query) || sub.code?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
    return true;
  });`;

if (source.includes(oldFilter)) {
  source = source.replace(oldFilter, newFilter);
  changed = true;
  console.log('patched: POS cabinet filter matches id and name aliases');
} else if (!source.includes('normalizeLineKey')) {
  console.warn('POS cabinet filter block was not found; no change applied.');
}

if (changed) fs.writeFileSync(filePath, source, 'utf8');
console.log('POS cabinet filter fix applied.');

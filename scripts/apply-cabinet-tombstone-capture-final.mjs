import fs from 'node:fs';

const path = 'src/lib/useGeneratorCloudSync.ts';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('MOLDATK_CAPTURE_DELETED_LINES_V2')) {
  const startNeedle = '    const onLocalChange = () => {';
  const start = src.indexOf(startNeedle);
  if (start < 0) throw new Error('Cabinet tombstone capture: onLocalChange start missing');
  const bodyStart = start + startNeedle.length;
  const end = src.indexOf('\n    };', bodyStart);
  if (end < 0) throw new Error('Cabinet tombstone capture: onLocalChange end missing');

  const injection = `
      // MOLDATK_CAPTURE_DELETED_LINES_V2
      if (ready.current && !refreshing.current) {
        try {
          const previous = lastSnapshot.current ? JSON.parse(lastSnapshot.current) : {};
          const previousLines: LineDistribution[] = Array.isArray(previous?.lines) ? previous.lines : [];
          const currentLines = readLocal<LineDistribution[]>(localKeys.lines, []);
          const currentIds = new Set(currentLines.map(line => line.id));
          const removed = previousLines
            .map(line => line?.id)
            .filter(Boolean)
            .filter(id => !currentIds.has(id));
          if (removed.length) {
            const tombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));
            removed.forEach(id => tombstones.add(String(id)));
            writeLocal(localKeys.deletedLines, Array.from(tombstones));
          }
        } catch (error) {
          console.warn('Cabinet tombstone capture failed:', error);
        }
      }
`;

  src = src.slice(0, bodyStart) + injection + src.slice(bodyStart);
  fs.writeFileSync(path, src, 'utf8');
}

const final = fs.readFileSync(path, 'utf8');
if (!final.includes('MOLDATK_CAPTURE_DELETED_LINES_V2')) throw new Error('Cabinet tombstone capture marker missing');
if (!final.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2')) throw new Error('Cabinet cloud-delete marker missing');

console.log('Applied resilient cabinet deletion tombstone capture.');

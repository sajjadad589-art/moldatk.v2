import fs from 'node:fs';

const path = 'src/lib/useGeneratorCloudSync.ts';

if (fs.existsSync(path)) {
  const source = fs.readFileSync(path, 'utf8');
  const lines = source.split('\n');
  let seenRecentWriteKey = false;
  let changed = false;

  const nextLines = lines.filter(line => {
    const isRecentWriteKey = line.includes('const recentWriteKey = (generatorId: string) => key(');
    if (!isRecentWriteKey) return true;
    if (seenRecentWriteKey) {
      changed = true;
      return false;
    }
    seenRecentWriteKey = true;
    return true;
  });

  if (changed) {
    fs.writeFileSync(path, nextLines.join('\n'));
    console.log('repair4 deduped recentWriteKey helper in useGeneratorCloudSync.ts');
  } else {
    console.log('repair4 found no duplicated recentWriteKey helper');
  }
}

console.log('Workmode final bundle repair4 applied.');

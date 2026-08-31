import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let source = fs.readFileSync(path, 'utf8');
let previous;

// Some older build-time permission replacements contain the original button inside
// the replacement, so a second npm script pass can wrap the same JSX twice.
// Collapse any duplicated permission wrapper until the source is stable.
do {
  previous = source;
  source = source
    .replace(/\{canCreateGeneratorAccount\s*&&\s*\{canCreateGeneratorAccount\s*&&\s*(<button[\s\S]*?<\/button>)\}\}/g, '{canCreateGeneratorAccount && $1}')
    .replace(/\{canEditGeneratorAccount\s*&&\s*\{canEditGeneratorAccount\s*&&\s*(<button[\s\S]*?<\/button>)\}\}/g, '{canEditGeneratorAccount && $1}')
    .replace(/\{canActivateGeneratorAccount\s*&&\s*\{canActivateGeneratorAccount\s*&&\s*(<button[\s\S]*?<\/button>)\}\}/g, '{canActivateGeneratorAccount && $1}');
} while (source !== previous);

fs.writeFileSync(path, source);
console.log('Normalized Super Admin permission wrappers');

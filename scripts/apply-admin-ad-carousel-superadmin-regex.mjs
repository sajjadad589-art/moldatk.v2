import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes("import { AdminAdSlidesPanel } from './AdminAdSlidesPanel';")) {
  src = src.replace(
    "import { calculateSubscriberBill } from '../utils/formatters';",
    "import { calculateSubscriberBill } from '../utils/formatters';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';"
  );
}

if (!src.includes('<AdminAdSlidesPanel />')) {
  src = src.replace('grid grid-cols-[420px_1fr] gap-5', 'grid grid-cols-[480px_1fr] gap-5');
  src = src.replace('grid grid-cols-[480px_1fr] gap-5', 'grid grid-cols-[480px_1fr] gap-5');

  const notificationFormNeedle = '<form onSubmit={sendNotification}';
  const idx = src.indexOf(notificationFormNeedle);
  if (idx >= 0) {
    src = src.slice(0, idx) + '<div className="space-y-5">\n              <AdminAdSlidesPanel />\n              ' + src.slice(idx);

    const afterIdx = src.indexOf('نشر الإشعار', idx);
    const formCloseIdx = afterIdx >= 0 ? src.indexOf('</form>', afterIdx) : -1;
    if (formCloseIdx >= 0) {
      const insertAt = formCloseIdx + '</form>'.length;
      src = src.slice(0, insertAt) + '\n            </div>' + src.slice(insertAt);
    }
  }
}

fs.writeFileSync(path, src);

const out = fs.readFileSync(path, 'utf8');
if (!out.includes("import { AdminAdSlidesPanel } from './AdminAdSlidesPanel';")) {
  throw new Error('AdminAdSlidesPanel import was not injected');
}
if (!out.includes('<AdminAdSlidesPanel />')) {
  throw new Error('AdminAdSlidesPanel was not inserted before notification form');
}
console.log('Super admin ad panel injected before notification form.');

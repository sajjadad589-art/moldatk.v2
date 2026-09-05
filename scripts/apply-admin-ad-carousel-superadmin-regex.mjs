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
  src = src.replace(
    /\{tab === 'notifications' && <div className="grid grid-cols-\[(?:420px|480px)_1fr\] gap-5">\s*<form onSubmit=\{sendNotification\}/,
    `{tab === 'notifications' && <div className="grid grid-cols-[480px_1fr] gap-5">
            <div className="space-y-5">
              <AdminAdSlidesPanel />
              <form onSubmit={sendNotification}`
  );

  src = src.replace(
    /(<button className="w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" \/>نشر الإشعار<\/button>\s*<\/form>)\s*<section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">/,
    `$1
            </div>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">`
  );
}

fs.writeFileSync(path, src);

const out = fs.readFileSync(path, 'utf8');
if (!out.includes("import { AdminAdSlidesPanel } from './AdminAdSlidesPanel';")) {
  throw new Error('AdminAdSlidesPanel import was not injected');
}
if (!out.includes('<AdminAdSlidesPanel />')) {
  throw new Error('AdminAdSlidesPanel was not inserted in notifications tab');
}
console.log('Super admin ad panel injected as standalone component.');

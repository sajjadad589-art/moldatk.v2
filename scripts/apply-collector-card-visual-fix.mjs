import fs from 'node:fs';

const path = 'src/components/POSQuickView.tsx';
let c = fs.readFileSync(path, 'utf8');

const marker = 'collector-approved-card-v2';
if (c.includes(marker)) {
  console.log('Collector approved mobile card design already applied');
  process.exit(0);
}

const mapStart = c.indexOf('unpaidSubscribersList.map(sub => {');
if (mapStart === -1) {
  console.log('Skip collector card design: unpaid subscriber list not found');
  process.exit(0);
}

const returnStart = c.indexOf('              return (', mapStart);
const cardStart = returnStart === -1 ? -1 : c.indexOf('                <div', returnStart);
const cardEndMarker = '              );\n            })';
const cardEnd = cardStart === -1 ? -1 : c.indexOf(cardEndMarker, cardStart);

if (cardStart === -1 || cardEnd === -1) {
  console.log('Skip collector card design: card block could not be located safely');
  process.exit(0);
}

const approvedCard = `                <div\n                  key={sub.id}\n                  data-design="${marker}"\n                  onClick={() => setPaymentSubscriber(sub)}\n                  className="relative overflow-hidden rounded-[28px] border border-rose-400/45 bg-gradient-to-br from-[#b41529] via-[#8d1025] to-[#56081a] px-5 py-4 sm:px-6 sm:py-5 shadow-[0_12px_35px_rgba(90,8,26,0.35)] active:scale-[0.99] transition-transform cursor-pointer"\n                  role="button"\n                  tabIndex={0}\n                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPaymentSubscriber(sub); }}\n                  aria-label={\`فتح تسديد المشترك \${sub.fullName}\`}\n                >\n                  <div className="grid grid-cols-[minmax(0,1.25fr)_0.75fr_0.9fr] items-center gap-4" dir="rtl">\n                    <div className="min-w-0 text-right">\n                      <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-blue-400/25 bg-[#12327a]/90 px-3 py-1.5 text-[11px] font-bold text-blue-100 shadow-sm">\n                        <span>كود :</span>\n                        <span className="font-mono text-sm tracking-wide" dir="ltr">{sub.subscriberCode || sub.code || 'MW-000'}</span>\n                      </div>\n                      <div className="mt-3 flex items-center gap-2 min-w-0">\n                        <MapPin className="h-5 w-5 shrink-0 text-blue-400" />\n                        <span className="truncate text-xl sm:text-2xl font-black text-white leading-tight">{sub.fullName}</span>\n                      </div>\n                    </div>\n\n                    <div className="text-center">\n                      <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-black text-white leading-none">\n                        <span>{sub.amperes}</span>\n                        <Zap className="h-6 w-6 fill-amber-400 text-amber-400" />\n                      </div>\n                      <span className="mt-2 block text-base sm:text-lg font-black text-white">أمبير</span>\n                    </div>\n\n                    <div className="text-left" dir="ltr">\n                      <span className="block text-2xl sm:text-3xl font-black leading-none text-white tabular-nums">{dueAmount.toLocaleString('en-US')}</span>\n                      <span className="mt-2 block text-base sm:text-lg font-black text-white">{generatorSpecs.currency || 'د.ع'}</span>\n                    </div>\n                  </div>\n                </div>\n`;

c = c.slice(0, cardStart) + approvedCard + c.slice(cardEnd);
fs.writeFileSync(path, c);
console.log('Applied approved collector mobile subscriber card design');

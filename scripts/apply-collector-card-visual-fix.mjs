import fs from 'node:fs';

const path = 'src/components/POSQuickView.tsx';
let c = fs.readFileSync(path, 'utf8');

const marker = 'collector-approved-card-v3';
if (c.includes(marker)) {
  console.log('Collector approved mobile card v3 already applied');
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

const approvedCard = `                <div\n                  key={sub.id}\n                  data-design="${marker}"\n                  onClick={() => setPaymentSubscriber(sub)}\n                  className="relative overflow-hidden rounded-[26px] border border-rose-300/60 bg-gradient-to-r from-[#c4142d] via-[#aa1028] to-[#7a0b20] px-4 py-5 sm:px-6 sm:py-6 shadow-[0_10px_30px_rgba(120,10,32,0.34)] active:scale-[0.99] transition-transform cursor-pointer"\n                  role="button"\n                  tabIndex={0}\n                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPaymentSubscriber(sub); }}\n                  aria-label={\`فتح تسديد المشترك \${sub.fullName}\`}\n                >\n                  <div className="grid grid-cols-[1.25fr_1fr_0.72fr] items-center divide-x divide-white/20" dir="rtl">\n                    <div className="min-w-0 px-3 sm:px-4 text-right">\n                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">اسم المشترك</span>\n                      <span className="mt-1 block truncate text-[22px] sm:text-[28px] font-black leading-tight text-white">{sub.fullName}</span>\n                    </div>\n\n                    <div className="px-3 sm:px-4 text-center">\n                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">المبلغ المطلوب</span>\n                      <span className="mt-1 block whitespace-nowrap text-[21px] sm:text-[27px] font-black leading-tight text-white tabular-nums" dir="ltr">{dueAmount.toLocaleString('en-US')} {generatorSpecs.currency || 'د.ع'}</span>\n                    </div>\n\n                    <div className="px-3 sm:px-4 text-center">\n                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">الأمبير</span>\n                      <div className="mt-1 flex items-center justify-center gap-1.5">\n                        <Zap className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 fill-amber-400 text-amber-400" />\n                        <span className="text-[24px] sm:text-[30px] font-black leading-none text-white tabular-nums">{sub.amperes}</span>\n                      </div>\n                    </div>\n                  </div>\n                </div>\n`;

c = c.slice(0, cardStart) + approvedCard + c.slice(cardEnd);
fs.writeFileSync(path, c);
console.log('Applied approved collector mobile subscriber card v3: name, amount, amperes only');

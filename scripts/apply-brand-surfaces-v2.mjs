import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const swap = (src, from, to) => src.includes(from) ? src.replaceAll(from, to) : src;

// Keep business-state colors (green/red/burgundy/partial/free) intact. Only brand/structural blues are changed.
const brandSurface = (path) => {
  let src = read(path);
  if (!src) return;
  src = swap(src, 'bg-[#1E3A8A]', 'bg-[#0B1F3B]');
  src = swap(src, 'hover:bg-blue-900', 'hover:bg-[#142A45]');
  src = swap(src, 'bg-blue-700 text-white', 'bg-[#0B1F3B] text-white');
  src = swap(src, 'bg-blue-600 text-white', 'bg-[#0B1F3B] text-white');
  src = swap(src, 'bg-blue-600 hover:bg-blue-700', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  src = swap(src, 'bg-blue-700 hover:bg-blue-800', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  src = swap(src, 'text-yellow-400', 'text-[#F2B544]');
  src = swap(src, 'text-amber-400', 'text-[#F2B544]');
  src = swap(src, 'border-blue-700/60', 'border-[#F2B544]/30');
  write(path, src);
};

[
  'src/components/PricingModal.tsx',
  'src/components/mobile/MobileMonthlyReports.tsx',
  'src/components/mobile/MobileSubscribers.tsx',
  'src/components/SubscribersView.tsx',
  'src/components/GeneratorMonitorView.tsx',
  'src/components/mobile/MobileMonitor.tsx',
  'src/components/SettingsFolderView.tsx',
  'src/components/mobile/MobileSettings.tsx',
  'src/components/POSQuickView.tsx',
  'src/components/SuperAdminDashboard.tsx',
].forEach(brandSurface);

// Receipt preview adopts brand structural color, while 58mm printed content remains high-contrast black for thermal printers.
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  let src = read(path);
  src = swap(src, 'bg-blue-600 text-white', 'bg-[#0B1F3B] text-white');
  src = swap(src, '>مولدتي</div>', '>مولدتك</div>');
  src = swap(src, "'*مولدتي*'", "'*مولدتك*'");
  write(path, src);
}

// Desktop and mobile report accents should use the calm identity, not vivid royal blue.
for (const path of ['src/components/MonthlyReportsView.tsx', 'src/components/mobile/MobileMonthlyReports.tsx']) {
  let src = read(path);
  if (!src) continue;
  src = swap(src, 'bg-blue-600', 'bg-[#0B1F3B]');
  src = swap(src, 'bg-blue-700', 'bg-[#142A45]');
  src = swap(src, 'text-blue-600', 'text-[#0B1F3B]');
  src = swap(src, 'dark:text-blue-400', 'dark:text-[#F2B544]');
  src = swap(src, 'border-blue-600', 'border-[#D89A21]');
  src = swap(src, 'ring-blue-500', 'ring-[#F2B544]');
  write(path, src);
}

// Ensure the brand mark is discoverable in Super Admin header if the dashboard has a textual brand placeholder.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  let src = read(path);
  if (src && !src.includes('SUPER_ADMIN_BRAND_MARK_V2')) {
    src = src.replace(
      '<span className="text-xl font-black">مولدتك</span>',
      '<span className="flex items-center gap-2" data-brand="SUPER_ADMIN_BRAND_MARK_V2"><img src="/brand/moldatk-mark.svg" alt="" className="w-8 h-8 rounded-lg bg-white p-1" /><span className="text-xl font-black">مولدتك</span></span>'
    );
  }
  write(path, src);
}

// Validation: destructive/accounting logic must still exist after purely visual changes.
const receipt = read('src/components/InvoiceReceiptModal.tsx');
const pricing = read('src/components/PricingModal.tsx');
const reports = read('src/components/mobile/MobileMonthlyReports.tsx');
const superAdmin = read('src/components/SuperAdminDashboard.tsx');
if (!receipt.includes('printSunmiReceipt')) throw new Error('Brand surfaces guard: SUNMI printing lost');
if (!pricing.includes('MonthlyTariffRecord')) throw new Error('Brand surfaces guard: monthly tariff logic lost');
if (!reports.includes('monthly')) throw new Error('Brand surfaces guard: monthly reports lost');
if (!superAdmin.includes('deleteGeneratorAccount')) throw new Error('Brand surfaces guard: protected Super Admin delete action lost');

console.log('Applied calm Moldatk brand to pricing, reports, subscriber surfaces, settings, monitoring, receipts, POS and Super Admin without changing accounting semantics.');

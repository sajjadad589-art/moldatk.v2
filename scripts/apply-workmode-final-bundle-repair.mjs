import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (content, from, to, label) => {
  if (!content.includes(from)) {
    console.warn('repair skip:', label);
    return content;
  }
  return content.replace(from, to);
};

// 1) Receipt: the first bundle may replace usages before helper insertion if prior patches changed anchors.
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if ((c.includes('displayPaymentMonth') || c.includes('displayIssueDate')) && !c.includes('const displayPaymentMonth')) {
      const helper = `
  // WORKMODE_RECEIPT_SIMPLE_DATE_MONTH_REPAIR
  const formatReceiptDate = (value?: string) => {
    const d = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    const datePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(safeDate);
    const timePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: true }).format(safeDate).replace('AM', 'ص').replace('PM', 'م');
    return datePart + '    ' + timePart;
  };
  const formatReceiptMonth = (raw?: string) => {
    const text = clean(raw);
    if (!text) return '';
    const iso = text.match(/(20\\d{2})[-\\/](\\d{1,2})/);
    if (iso) return String(Number(iso[2])) + '-' + iso[1];
    const named = text.match(/شهر\\s*(\\d{1,2}).*?(20\\d{2})/);
    if (named) return String(Number(named[1])) + '-' + named[2];
    return text;
  };
  const displayIssueDate = formatReceiptDate(issueDate);
  const displayPaymentMonth = formatReceiptMonth(paymentMonth || invoice?.monthId);
`;
      const re = /  const statusText = [^\n]+;\n/;
      if (re.test(c)) c = c.replace(re, (m) => m + helper);
      else console.warn('repair skip: receipt statusText anchor');
      write(path, c);
      console.log('repaired receipt date/month helper scope');
    }
  }
}

// 2) MobileLayout: guarantee theme/month props exist when JSX references mobileTheme.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('data-moldatk-theme={mobileTheme}') && !c.includes('mobileTheme?: string')) {
      if (!c.includes('MonthlyTariffRecord')) {
        c = c.replace('  SettingsFolderItem,\n  DeviceViewMode,', '  SettingsFolderItem,\n  DeviceViewMode,\n  MonthlyTariffRecord,');
      }
      c = replaceOnce(c, '  subscriptionLoading?: boolean;\n}', '  subscriptionLoading?: boolean;\n  monthlyTariffs?: MonthlyTariffRecord[];\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}', 'MobileLayout props');
      c = replaceOnce(c, '  subscriptionLoading = false,\n}) => {', "  subscriptionLoading = false,\n  monthlyTariffs = [],\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {", 'MobileLayout destructure');
      if (c.includes('<MobileMonthlyReports') && !c.includes('monthlyTariffs={monthlyTariffs}')) {
        c = c.replace('            currency={generatorSpecs.currency || \'د.ع\'}\n          />', '            currency={generatorSpecs.currency || \'د.ع\'}\n            monthlyTariffs={monthlyTariffs}\n          />');
      }
      if (c.includes('<MobileSettings') && !c.includes('mobileTheme={mobileTheme}')) {
        c = c.replace('            subscriptionLoading={subscriptionLoading}\n          />', '            subscriptionLoading={subscriptionLoading}\n            mobileTheme={mobileTheme}\n            onChangeMobileTheme={onChangeMobileTheme}\n          />');
      }
      write(path, c);
      console.log('repaired MobileLayout theme/month props');
    }
  }
}

// 3) MobileSettings: guarantee ad/theme state/functions exist after injected UI.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('announcementCards') && !c.includes('const [announcementCards')) {
      if (!c.includes("from '../../lib/supabase'")) {
        c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
      }
      if (!c.includes('mobileTheme?: string')) {
        c = replaceOnce(c, '  subscriptionLoading?: boolean;\n}', '  subscriptionLoading?: boolean;\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}', 'MobileSettings props');
      }
      if (!c.includes("mobileTheme = 'ocean-calm'")) {
        c = replaceOnce(c, '  subscriptionInfo = null,\n  subscriptionLoading = false,\n}) => {', "  subscriptionInfo = null,\n  subscriptionLoading = false,\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {", 'MobileSettings destructure');
      }
      const stateBlock = `
  const [announcementCards, setAnnouncementCards] = React.useState<any[]>([]);
  const themeOptions = [
    { id: 'ocean-calm', label: 'بحري هادئ', desc: 'هادي، منعش، واضح', color: '#16a3a8' },
    { id: 'green-comfort', label: 'أخضر مريح', desc: 'راحة واستقرار', color: '#37a86d' },
    { id: 'soft-gold', label: 'ذهبي فاتح', desc: 'دافئ وفخم', color: '#d4af37' },
    { id: 'light-metal', label: 'معدني فاتح', desc: 'نظيف واحترافي', color: '#94a3b8' },
    { id: 'official-dark', label: 'داكن رسمي', desc: 'ليلي وهادئ', color: '#0f172a' },
  ];
  const applyTheme = (id: string) => {
    try {
      localStorage.setItem('moldatk_mobile_theme', id);
      document.documentElement.setAttribute('data-moldatk-theme', id);
    } catch (e) {}
    if (onChangeMobileTheme) onChangeMobileTheme(id);
  };

  React.useEffect(() => {
    let cancelled = false;
    const loadAds = async () => {
      try {
        const cached = localStorage.getItem('moldatk_mobile_announcement_cards');
        if (cached && !cancelled) setAnnouncementCards(JSON.parse(cached));
      } catch (e) {}
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_notifications')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(8);
        if (!error && Array.isArray(data)) {
          const rows = data.filter((a: any) => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now));
          localStorage.setItem('moldatk_mobile_announcement_cards', JSON.stringify(rows));
          if (!cancelled) setAnnouncementCards(rows);
        }
      } catch (e) {}
    };
    void loadAds();
    const timer = window.setInterval(() => void loadAds(), 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
`;
      c = c.replace(/\n\}\) => \{\n/, (m) => m + stateBlock);
      write(path, c);
      console.log('repaired MobileSettings ad/theme declarations');
    }
  }
}

// 4) MobileSubscribers: guarantee dashboard filter hook and independent subscriber page.
{
  const path = 'src/components/mobile/MobileSubscribers.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('readInitialStatusFilter') && !c.includes('const readInitialStatusFilter')) {
      c = replaceOnce(c, '  onOpenSubscriberModal,\n  onDeleteSubscriber,', '  onOpenSubscriberModal,\n  onOpenReceiptModal,\n  onDeleteSubscriber,', 'MobileSubscribers destructure receipt');
      const stateBlock = `
  const readInitialStatusFilter = (): 'all' | 'unpaid' | 'paid' | 'partial' | 'free' => {
    try {
      const saved = localStorage.getItem('moldatk_mobile_subscribers_filter');
      localStorage.removeItem('moldatk_mobile_subscribers_filter');
      if (saved === 'paid' || saved === 'unpaid' || saved === 'partial' || saved === 'free') return saved;
    } catch (e) {}
    return 'all';
  };
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
`;
      c = c.replace(/\n\}\) => \{\n/, (m) => m + stateBlock);
      console.log('repaired MobileSubscribers filter/page state');
    }
    if (c.includes('setSelectedSubscriber(sub)') && !c.includes('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR')) {
      const pageBlock = `
  if (selectedSubscriber) {
    const sub = selectedSubscriber;
    const remaining = Math.max(0, Number(sub.amountDue || 0) - Number(sub.amountPaid || 0));
    const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
    const isPaid = !isFree && (sub.paymentStatus === 'paid' || remaining === 0);
    const statusLabel = isFree ? 'مجاني' : isPaid ? 'مسدد' : sub.paymentStatus === 'partial' ? 'مسدد جزئياً' : 'غير مسدد';
    const statusClass = isPaid ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : isFree ? 'text-slate-600 bg-slate-50 border-slate-100' : 'text-rose-600 bg-rose-50 border-rose-100';
    return (
      <div className="WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR p-3.5 space-y-3.5 max-w-lg mx-auto pb-24 bg-slate-50 dark:bg-[#070d1e] min-h-screen" dir="rtl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setSelectedSubscriber(null)} className="px-3 py-2 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black">رجوع</button>
          <h2 className="text-base font-black text-slate-900 dark:text-white">ملف المشترك</h2>
          <button type="button" onClick={() => onOpenSubscriberModal(sub)} className="px-3 py-2 rounded-2xl bg-blue-600 text-white text-xs font-black">تعديل</button>
        </div>
        <section className="rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-3xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0"><Users className="w-8 h-8" /></div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-slate-950 dark:text-white truncate">{sub.fullName}</h3>
              <p className="text-xs font-mono text-slate-500 mt-1">{sub.code || sub.subscriberCode}</p>
              <span className={'mt-3 inline-flex px-3 py-1 rounded-xl border text-xs font-black ' + statusClass}>{statusLabel}</span>
            </div>
          </div>
        </section>
        <section className="rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 overflow-hidden">
          {[
            ['رقم الهاتف', sub.phone || '—'],
            ['الكابينة', sub.lineName || sub.line || 'غير محددة'],
            ['عدد الأمبيرات', formatNumberArabic(sub.amperes) + ' أمبير'],
            ['المبلغ المستحق', isFree ? 'مجاني' : formatCurrency(Number(sub.amountDue || 0))],
            ['المبلغ المدفوع', formatCurrency(Number(sub.amountPaid || 0))],
            ['المتبقي', formatCurrency(remaining)],
            ['العنوان', sub.address || '—'],
            ['رقم الصندوق', sub.boxNumber || '—'],
            ['ملاحظات', sub.notes || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500">{label}</span>
              <strong className="text-sm font-black text-slate-900 dark:text-white text-left">{value}</strong>
            </div>
          ))}
        </section>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onOpenReceiptModal(sub)} className="py-3 rounded-2xl bg-emerald-600 text-white text-xs font-black">تسديد</button>
          <button type="button" onClick={() => sub.phone && window.open('tel:' + sub.phone)} className="py-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black">اتصال</button>
          <button type="button" onClick={() => sub.phone && window.open('https://wa.me/964' + sub.phone.replace(/^0/, ''))} className="py-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black">واتساب</button>
        </div>
        <button type="button" onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا المشترك؟')) { onDeleteSubscriber(sub.id); setSelectedSubscriber(null); } }} className="w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف المشترك</button>
      </div>
    );
  }

`;
      c = c.replace(/\n  return \(\n/, '\n' + pageBlock + '  return (\n');
      console.log('repaired MobileSubscribers independent detail page');
    }
    write(path, c);
  }
}

console.log('Workmode final bundle repair applied.');

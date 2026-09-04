import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const addAfter = (content, anchor, addition, label) => {
  if (!content.includes(anchor)) {
    console.warn('repair2 skip:', label);
    return content;
  }
  return content.replace(anchor, anchor + addition);
};

// MobileLayout: final theme/month prop recovery regardless of previous partial patches.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('data-moldatk-theme={mobileTheme}') || c.includes('mobileTheme={mobileTheme}') || c.includes('onChangeMobileTheme={onChangeMobileTheme}')) {
      if (!c.includes('MonthlyTariffRecord')) {
        c = c.replace('  DeviceViewMode,', '  DeviceViewMode,\n  MonthlyTariffRecord,');
      }
      if (!c.includes('mobileTheme?: string')) {
        c = c.replace('  subscriptionLoading?: boolean;\n}', '  subscriptionLoading?: boolean;\n  monthlyTariffs?: MonthlyTariffRecord[];\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}');
      }
      if (!c.includes("mobileTheme = 'ocean-calm'")) {
        c = c.replace(/(\n  subscriptionLoading\s*=\s*false,\n)(\}\) => \{)/, "$1  monthlyTariffs = [],\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n$2");
      }
      if (c.includes('<MobileMonthlyReports') && !c.includes('monthlyTariffs={monthlyTariffs}')) {
        c = c.replace('            currency={generatorSpecs.currency || \'د.ع\'}\n          />', '            currency={generatorSpecs.currency || \'د.ع\'}\n            monthlyTariffs={monthlyTariffs}\n          />');
      }
      if (c.includes('<MobileSettings') && !c.includes('mobileTheme={mobileTheme}')) {
        c = c.replace('            subscriptionLoading={subscriptionLoading}\n          />', '            subscriptionLoading={subscriptionLoading}\n            mobileTheme={mobileTheme}\n            onChangeMobileTheme={onChangeMobileTheme}\n          />');
      }
      write(path, c);
      console.log('repair2 finalized MobileLayout theme props');
    }
  }
}

// MobileSettings: final prop/destructure recovery after injected theme UI.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('mobileTheme') || c.includes('onChangeMobileTheme') || c.includes('themeOptions') || c.includes('announcementCards')) {
      if (!c.includes("from '../../lib/supabase'")) {
        c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
      }
      if (!c.includes('mobileTheme?: string')) {
        c = c.replace('  subscriptionLoading?: boolean;\n}', '  subscriptionLoading?: boolean;\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}');
      }
      if (!c.includes("mobileTheme = 'ocean-calm'")) {
        c = c.replace(/(\n  subscriptionLoading\s*=\s*false,\n)(\}\) => \{)/, "$1  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n$2");
      }
      if (c.includes('announcementCards') && !c.includes('const [announcementCards')) {
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
        const { data, error } = await supabase.from('app_notifications').select('*').eq('is_active', true).order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(8);
        if (!error && Array.isArray(data)) {
          const rows = data.filter((a: any) => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now));
          localStorage.setItem('moldatk_mobile_announcement_cards', JSON.stringify(rows));
          if (!cancelled) setAnnouncementCards(rows);
        }
      } catch (e) {}
    };
    void loadAds();
    const timer = window.setInterval(() => void loadAds(), 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
`;
        c = c.replace(/\n\}\) => \{\n/, (m) => m + stateBlock);
      }
      write(path, c);
      console.log('repair2 finalized MobileSettings ads/themes');
    }
  }
}

// MobileSubscribers: final independent page binding.
{
  const path = 'src/components/mobile/MobileSubscribers.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (c.includes('setSelectedSubscriber') || c.includes('WORKMODE_MOBILE_SUBSCRIBER_PAGE_REPAIR')) {
      // Ensure component props are in the destructuring even if prior scripts removed them.
      if (!/\n  onOpenReceiptModal,/.test(c)) {
        c = addAfter(c, '  onOpenSubscriberModal,\n', '  onOpenReceiptModal,\n', 'MobileSubscribers add receipt destructure');
      }
      if (!/\n  onDeleteSubscriber,/.test(c)) {
        const receiptAnchor = c.includes('  onOpenReceiptModal,\n') ? '  onOpenReceiptModal,\n' : '  onOpenSubscriberModal,\n';
        c = addAfter(c, receiptAnchor, '  onDeleteSubscriber,\n', 'MobileSubscribers add delete destructure');
      }
      if (c.includes('Trash2') && !/import \{[^}]*Trash2[^}]*\} from 'lucide-react';/.test(c)) {
        c = c.replace(/import \{([^}]*)\} from 'lucide-react';/, (m, names) => `import {${names}, Trash2} from 'lucide-react';`);
      }
      if (c.includes('<Trash2') && !c.includes("from 'lucide-react'")) {
        c = c.replace(/<Trash2[^>]*\/>/g, '');
      }
      // If state is referenced but not defined, define it at the top of the component.
      if (c.includes('readInitialStatusFilter') && !c.includes('const readInitialStatusFilter')) {
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
      }
      if (c.includes('setSelectedSubscriber') && !c.includes('const [selectedSubscriber')) {
        c = c.replace(/\n\}\) => \{\n/, (m) => m + "  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);\n");
      }
      write(path, c);
      console.log('repair2 finalized MobileSubscribers bindings');
    }
  }
}

console.log('Workmode final bundle repair2 applied.');

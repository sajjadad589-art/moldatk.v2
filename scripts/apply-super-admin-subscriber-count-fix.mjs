import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const stateMarker = "  const [notifications, setNotifications] = useState<AppNotification[]>([]);";
const stateAddition = `${stateMarker}\n  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});\n  const [totalSubscribers, setTotalSubscribers] = useState(0);`;
if (!source.includes('const [subscriberCounts,')) {
  if (!source.includes(stateMarker)) throw new Error('Subscriber count state marker not found');
  source = source.replace(stateMarker, stateAddition);
  changed = true;
}

const promiseMarker = "    const [g, s, p, t, n] = await Promise.all([";
const promiseReplacement = "    const [g, s, p, t, n, gs] = await Promise.all([";
if (source.includes(promiseMarker)) {
  source = source.replace(promiseMarker, promiseReplacement);
  changed = true;
}

const notificationQuery = "      supabase.from('app_notifications').select('*').order('created_at', { ascending: false }),\n    ]);";
const notificationReplacement = "      supabase.from('app_notifications').select('*').order('created_at', { ascending: false }),\n      supabase.from('generator_subscribers').select('generator_id'),\n    ]);";
if (source.includes(notificationQuery)) {
  source = source.replace(notificationQuery, notificationReplacement);
  changed = true;
}

const errorMarker = "    const firstError = g.error || s.error || p.error || t.error || n.error;";
const errorReplacement = "    const firstError = g.error || s.error || p.error || t.error || n.error || gs.error;";
if (source.includes(errorMarker)) {
  source = source.replace(errorMarker, errorReplacement);
  changed = true;
}

const notificationSetMarker = "      setNotifications((n.data || []) as AppNotification[]);";
const notificationSetReplacement = `${notificationSetMarker}\n      const counts: Record<string, number> = {};\n      for (const row of (gs.data || []) as Array<{ generator_id: string | null }>) {\n        if (!row.generator_id) continue;\n        counts[row.generator_id] = (counts[row.generator_id] || 0) + 1;\n      }\n      setSubscriberCounts(counts);\n      setTotalSubscribers((gs.data || []).length);`;
if (!source.includes('setSubscriberCounts(counts);')) {
  if (!source.includes(notificationSetMarker)) throw new Error('Subscriber count load marker not found');
  source = source.replace(notificationSetMarker, notificationSetReplacement);
  changed = true;
}

const statsMarker = "      total: generators.length,";
const statsReplacement = `${statsMarker}\n      subscribers: totalSubscribers,`;
if (!source.includes('subscribers: totalSubscribers')) {
  if (!source.includes(statsMarker)) throw new Error('Stats marker not found');
  source = source.replace(statsMarker, statsReplacement);
  changed = true;
}

source = source.replace(
  "  }, [generators, subscriptions, transactions]);",
  "  }, [generators, subscriptions, transactions, totalSubscribers]);"
);

const cardsMarker = "                ['إجمالي أصحاب المولدات', stats.total, Building2],\n                ['الحسابات الفعالة', stats.active, ShieldCheck],";
const cardsReplacement = "                ['إجمالي أصحاب المولدات', stats.total, Building2],\n                ['إجمالي المشتركين', stats.subscribers, Users],\n                ['الحسابات الفعالة', stats.active, ShieldCheck],";
if (!source.includes("['إجمالي المشتركين', stats.subscribers, Users]")) {
  if (!source.includes(cardsMarker)) throw new Error('Overview subscriber card marker not found');
  source = source.replace(cardsMarker, cardsReplacement);
  changed = true;
}
source = source.replace('className="grid grid-cols-4 gap-5 mb-5"', 'className="grid grid-cols-5 gap-5 mb-5"');

const tableHeader = '<th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">ينتهي الاشتراك</th>';
const tableHeaderReplacement = '<th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">عدد المشتركين</th><th className="p-4 text-right">ينتهي الاشتراك</th>';
if (!source.includes('<th className="p-4 text-right">عدد المشتركين</th>')) {
  if (!source.includes(tableHeader)) throw new Error('Subscriber count table header marker not found');
  source = source.replace(tableHeader, tableHeaderReplacement);
  changed = true;
}

const tableCell = '<td className="p-4">{g.area || \'—\'}</td><td className="p-4 font-bold">{sub ? dateText(sub.ends_at) : \'—\'}</td>';
const tableCellReplacement = '<td className="p-4">{g.area || \'—\'}</td><td className="p-4 font-black">{subscriberCounts[g.id] || 0}</td><td className="p-4 font-bold">{sub ? dateText(sub.ends_at) : \'—\'}</td>';
if (!source.includes('{subscriberCounts[g.id] || 0}')) {
  if (!source.includes(tableCell)) throw new Error('Subscriber count table cell marker not found');
  source = source.replace(tableCell, tableCellReplacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Applied super admin subscriber count fix');
} else {
  console.log('Super admin subscriber count fix already applied');
}

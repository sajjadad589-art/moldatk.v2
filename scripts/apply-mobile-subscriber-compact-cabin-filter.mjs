import fs from 'node:fs';

const target = 'src/components/mobile/MobileSubscribers.tsx';
const content = `import React, { useMemo, useState } from 'react';
import { Search, Plus, Phone, Users, X, Trash2 } from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, LineDistribution } from '../../types';
import { formatCurrency, formatNumberArabic } from '../../utils/formatters';
import { getSubscriberStyleByStatus } from '../SubscribersView';

interface MobileSubscribersProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  lines: LineDistribution[];
  onTogglePaymentStatus: (subId: string) => void;
  onOpenSubscriberModal: (subscriber?: Subscriber | null) => void;
  onOpenReceiptModal: (subscriber: Subscriber) => void;
  onDeleteSubscriber: (subId: string) => void;
}

export const MobileSubscribers: React.FC<MobileSubscribersProps> = ({
  subscribers,
  lines,
  onOpenSubscriberModal,
  onDeleteSubscriber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial' | 'free'>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');

  const selectedLine = useMemo(() => lines.find(line => line.id === lineFilter), [lines, lineFilter]);

  const filteredSubscribers = subscribers.filter(sub => {
    const needle = searchTerm.trim().toLowerCase();
    const matchesSearch = !needle ||
      (sub.fullName || '').toLowerCase().includes(needle) ||
      (sub.phone || '').toLowerCase().includes(needle) ||
      (sub.code || '').toLowerCase().includes(needle) ||
      (sub.boxNumber || '').toLowerCase().includes(needle) ||
      (sub.lineName || sub.line || '').toLowerCase().includes(needle);

    const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'free'
      ? isFree
      : sub.paymentStatus === statusFilter;

    const matchesLine = lineFilter === 'all'
      ? true
      : sub.lineId === lineFilter ||
        (!!selectedLine?.name && (sub.lineName === selectedLine.name || sub.line === selectedLine.name));

    return matchesSearch && matchesStatus && matchesLine;
  });

  const paidCount = subscribers.filter(s => s.paymentStatus === 'paid').length;
  const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;
  const unpaidCount = subscribers.filter(s => s.paymentStatus === 'unpaid').length;
  const freeCount = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free').length;

  return (
    <div className="p-2.5 space-y-2.5 max-w-lg mx-auto pb-24">
      <div className="space-y-2 sticky top-[53px] z-30 bg-slate-50/95 dark:bg-[#070d1e]/95 backdrop-blur-md pt-1 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث بالاسم، الهاتف، الكود أو القاطع..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-9 py-2 text-[11px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute left-3 top-2.5 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" aria-label="فلتر الكابينات">
          <button
            onClick={() => setLineFilter('all')}
            className={\`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap border transition-all \${
              lineFilter === 'all'
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }\`}
          >
            كل الكابينات
          </button>
          {lines.map(line => (
            <button
              key={line.id}
              onClick={() => setLineFilter(line.id)}
              className={\`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap border transition-all \${
                lineFilter === line.id
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }\`}
            >
              {line.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            ['all', \`الكل (\${formatNumberArabic(subscribers.length)})\`],
            ['unpaid', \`غير مسدد (\${formatNumberArabic(unpaidCount)})\`],
            ['paid', \`مسدد كامل (\${formatNumberArabic(paidCount)})\`],
            ['partial', \`جزئي (\${formatNumberArabic(partialCount)})\`],
            ['free', \`إعفاء (\${formatNumberArabic(freeCount)})\`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id as typeof statusFilter)}
              className={\`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all \${
                statusFilter === id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }\`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredSubscribers.length === 0 ? (
        <div className="py-14 text-center space-y-2">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد نتائج مطابقة</h3>
          <p className="text-xs text-slate-400">غيّر البحث أو فلتر الكابينة أو حالة التسديد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubscribers.map(sub => {
            const isPartial = sub.paymentStatus === 'partial';
            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
            const styles = getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus);
            const visibleAmount = isFree
              ? 'إعفاء'
              : isPartial
              ? formatCurrency(Math.max(0, Number(sub.amountDue || 0) - Number(sub.amountPaid || 0)))
              : formatCurrency(Number(sub.amountDue || 0));

            return (
              <div
                key={sub.id}
                onClick={() => onOpenSubscriberModal(sub)}
                className={\`rounded-2xl px-3 py-2.5 transition-all cursor-pointer \${styles.cardBg} \${styles.cardBorderAccent}\`}
              >
                <div className="grid grid-cols-[1.45fr_.7fr_1fr] gap-2 items-start">
                  <div className="min-w-0">
                    <span className="block text-[9px] font-bold text-white/70 mb-0.5">اسم المشترك</span>
                    <h4 className={\`text-sm font-black truncate leading-5 \${styles.nameText}\`}>{sub.fullName}</h4>
                    <span className="text-[9px] font-mono text-white/65 tabular-nums">{sub.code}</span>
                  </div>

                  <div className="text-center">
                    <span className="block text-[9px] font-bold text-white/70 mb-0.5">الأمبير</span>
                    <span className="text-sm font-black text-cyan-300 tabular-nums">A {formatNumberArabic(sub.amperes)}</span>
                  </div>

                  <div className="text-left min-w-0">
                    <span className="block text-[9px] font-bold text-white/70 mb-0.5">المبلغ</span>
                    <span className="block text-sm font-black text-white tabular-nums truncate">{visibleAmount}</span>
                  </div>
                </div>

                <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 text-[9px] text-white/70">
                    {sub.phone && (
                      <span className="flex items-center gap-1 tabular-nums truncate">
                        <Phone className="w-3 h-3 shrink-0" />
                        {sub.phone}
                      </span>
                    )}
                    {(sub.lineName || sub.line) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/15 truncate max-w-[90px]">
                        {sub.lineName || sub.line}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(\`هل تريد حذف المشترك \${sub.fullName}؟ لا يمكن التراجع عن هذه العملية.\`)) {
                        onDeleteSubscriber(sub.id);
                      }
                    }}
                    className="w-7 h-7 shrink-0 rounded-lg bg-black/15 hover:bg-rose-500/30 text-white/80 flex items-center justify-center active:scale-95 transition-all"
                    title="حذف المشترك"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isPartial && (
                  <div className="mt-1.5 px-2 py-1 rounded-lg bg-black/15 flex items-center justify-between text-[9px] font-bold text-white/80">
                    <span>المسدد: {formatCurrency(sub.amountPaid || 0)}</span>
                    <span>المطلوب: {formatCurrency(sub.amountDue || 0)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => onOpenSubscriberModal(null)}
        className="fixed bottom-20 left-3 z-40 w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-all"
        title="إضافة مشترك جديد"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
};
`;

fs.writeFileSync(target, content);
console.log('Applied compact mobile subscriber cards with cabin filter, removed subscription type and file chip');

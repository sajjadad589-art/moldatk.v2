import React, { useState } from 'react';
import {
  Search,
  Plus,
  Phone,
  Check,
  AlertCircle,
  Coins,
  HeartHandshake,
  CreditCard,
  Users,
  X,
  ChevronLeft,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
  pricingTiers,
  lines,
  onTogglePaymentStatus,
  onOpenSubscriberModal,
  onOpenReceiptModal,
  onDeleteSubscriber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial' | 'free'>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch =
      sub.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.phone.includes(searchTerm) ||
      sub.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.boxNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'paid'
        ? sub.paymentStatus === 'paid'
        : statusFilter === 'partial'
        ? sub.paymentStatus === 'partial'
        : statusFilter === 'unpaid'
        ? sub.paymentStatus === 'unpaid'
        : sub.paymentStatus === 'free' || sub.tier === 'free';

    const matchesLine = lineFilter === 'all' ? true : sub.lineId === lineFilter;

    return matchesSearch && matchesStatus && matchesLine;
  });

  const paidCount = subscribers.filter(s => s.paymentStatus === 'paid').length;
  const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;
  const unpaidCount = subscribers.filter(s => s.paymentStatus === 'unpaid').length;
  const freeCount = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free').length;

  return (
    <div className="p-3.5 space-y-3.5 max-w-lg mx-auto pb-24">
      {/* 1. Sticky Search and Quick Filter Row */}
      <div className="space-y-2 sticky top-[53px] z-30 bg-slate-50/95 dark:bg-[#070d1e]/95 backdrop-blur-md pt-1 pb-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بالاسم، الهاتف، الكود، أو القاطع..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-9 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Color Legend for Mobile */}
        <div className="flex items-center justify-between gap-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold overflow-x-auto no-scrollbar">
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span>أحمر (غير مسدد)</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-200" />
            <span>أبيض (مسدد كامل)</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>أصفر (جزئي)</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>رمادي (إعفاء)</span>
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#111c38] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            الكل ({formatNumberArabic(subscribers.length)})
          </button>

          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              statusFilter === 'unpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#111c38] text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>غير مسدد ({formatNumberArabic(unpaidCount)})</span>
          </button>

          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              statusFilter === 'paid'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white dark:bg-[#111c38] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>مسدد كامل ({formatNumberArabic(paidCount)})</span>
          </button>

          <button
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              statusFilter === 'partial'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#111c38] text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>جزئي ({formatNumberArabic(partialCount)})</span>
          </button>

          <button
            onClick={() => setStatusFilter('free')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              statusFilter === 'free'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#111c38] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>إعفاء ({formatNumberArabic(freeCount)})</span>
          </button>
        </div>
      </div>

      {/* 2. Subscribers Cards List */}
      {filteredSubscribers.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 opacity-60" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد نتائج مطابقة</h3>
          <p className="text-xs text-slate-400">جرب كتابة اسم مختلف أو إعادة تعيين الفلترة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubscribers.map(sub => {
            const styles = getSubscriberStyleByStatus(sub.paymentStatus);
            const isPartial = sub.paymentStatus === 'partial';
            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
            const tierData = pricingTiers.find(p => p.type === sub.tier);

            return (
              <div
                key={sub.id}
                onClick={() => onOpenSubscriberModal(sub)}
                className={`rounded-3xl p-4 transition-all cursor-pointer group ${styles.cardBg} ${styles.cardBorderAccent}`}
              >
                {/* Header Row: Name & Phone & Tier Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${styles.avatarBg}`}>
                      {sub.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold truncate ${styles.nameText}`}>
                        {sub.fullName}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                        <span className="bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          {sub.code}
                        </span>
                        {sub.phone && (
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums font-sans text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{sub.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tier Badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${styles.badgeBg}`}>
                    {tierData?.nameAr || sub.tier}
                  </span>
                </div>

                {/* Info Bar: Amperes, Box, Bill Amount */}
                <div className={`grid grid-cols-3 gap-1.5 p-2 rounded-2xl my-2 text-center ${styles.innerSubBox}`}>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">الأمبيرات</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 tabular-nums">
                      {formatNumberArabic(sub.amperes)} A
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">القاطع</span>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate block">
                      {sub.boxNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                      {isPartial ? 'المتبقي' : 'المبلغ'}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums truncate block">
                      {isFree
                        ? 'إعفاء'
                        : isPartial
                        ? formatCurrency(Math.max(0, sub.amountDue - (sub.amountPaid || 0)))
                        : formatCurrency(sub.amountDue)}
                    </span>
                  </div>
                </div>

                {/* If partial, show quick stats */}
                {isPartial && (
                  <div className="px-2 py-1 mb-2 rounded-xl bg-amber-200/60 dark:bg-amber-900/50 flex items-center justify-between text-[10px] font-bold text-amber-900 dark:text-amber-200">
                    <span>المسدد: {formatCurrency(sub.amountPaid || 0)}</span>
                    <span>المطلوب: {formatCurrency(sub.amountDue)}</span>
                  </div>
                )}

                {/* Bottom Row: Quick Payment Action Trigger (Status text is hidden) */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePaymentStatus(sub.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-xs cursor-pointer active:scale-98"
                    title="تغيير طريقة التسديد"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-yellow-300" />
                    <span>تسديد / خيارات الدفع 💳</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`هل تريد حذف المشترك ${sub.fullName}؟ لا يمكن التراجع عن هذه العملية.`)) {
                        onDeleteSubscriber(sub.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-black bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 active:scale-95 transition-all"
                    title="حذف المشترك"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>

                  {/* Open details prompt */}
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                    <span>ملف</span>
                    <ChevronLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Floating Action Button (Add New) */}
      <button
        onClick={() => onOpenSubscriberModal(null)}
        className="fixed bottom-20 left-4 z-40 w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        title="إضافة مشترك جديد"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

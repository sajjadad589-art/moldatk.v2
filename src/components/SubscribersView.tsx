import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, LineDistribution, SubscriberInvoice } from '../types';

export const getSubscriberStyleByStatus = (status: Subscriber['paymentStatus']) => {
  if (status === 'paid') return { cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/20', cardBorderAccent: 'border border-emerald-200 dark:border-emerald-900/50', avatarBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/70 dark:bg-slate-900/50', innerSubBox: 'bg-white/70 dark:bg-slate-900/40' };
  if (status === 'partial') return { cardBg: 'bg-amber-50/60 dark:bg-amber-950/20', cardBorderAccent: 'border border-amber-200 dark:border-amber-900/50', avatarBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/70 dark:bg-slate-900/50', innerSubBox: 'bg-white/70 dark:bg-slate-900/40' };
  if (status === 'free') return { cardBg: 'bg-blue-50/60 dark:bg-blue-950/20', cardBorderAccent: 'border border-blue-200 dark:border-blue-900/50', avatarBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/70 dark:bg-slate-900/50', innerSubBox: 'bg-white/70 dark:bg-slate-900/40' };
  return { cardBg: 'bg-white dark:bg-[#131E38]', cardBorderAccent: 'border border-rose-200 dark:border-rose-900/40', avatarBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/70 dark:bg-slate-900/50', innerSubBox: 'bg-white/70 dark:bg-slate-900/40' };
};

interface SubscribersViewProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  lines: LineDistribution[];
  onTogglePaymentStatus: (subId: string) => void;
  onOpenSubscriberModal: (sub?: Subscriber) => void;
  onOpenReceiptModal: (sub: Subscriber, invoice?: SubscriberInvoice) => void;
  onDeleteSubscriber: (subId: string) => void;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({
  subscribers,
  pricingTiers,
  lines,
  onOpenSubscriberModal,
  onDeleteSubscriber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'free'>('all');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedTier] = useState<string>('all');

  // مراجع لحالة السحب المتكامل (ماوس + لمس) للشريط الأفقي
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // أحداث الماوس
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  // أحداث اللمس للأجهزة المحمولة واللوحية
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const formatNum = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US');
  };

  const countPaid = subscribers.filter(s => s.paymentStatus === 'paid').length;
  const countUnpaid = subscribers.filter(s => s.paymentStatus === 'unpaid').length;
  const countPartial = subscribers.filter(s => s.paymentStatus === 'partial').length;
  const countFree = subscribers.filter(s => s.paymentStatus === 'free').length;

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch =
      sub.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.phone.includes(searchTerm);

    if (!matchesSearch) return false;

    if (filterStatus === 'paid' && sub.paymentStatus !== 'paid') return false;
    if (filterStatus === 'unpaid' && sub.paymentStatus !== 'unpaid') return false;
    if (filterStatus === 'partial' && sub.paymentStatus !== 'partial') return false;
    if (filterStatus === 'free' && sub.paymentStatus !== 'free') return false;

    if (selectedLine !== 'all' && sub.lineName !== selectedLine) return false;
    if (selectedTier !== 'all' && sub.tier !== selectedTier) return false;

    return true;
  });

  return (
    <div className="space-y-6 font-['Cairo']" dir="rtl">
      
      {/* 1. بوردات الفلترة السريعة للمشتركين */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setFilterStatus('all')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm ${
            filterStatus === 'all'
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
              : 'bg-white dark:bg-[#131E38] border-slate-200 dark:border-blue-900/50 hover:border-blue-500 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">إجمالي المشتركين</span>
            <Users className="w-4 h-4" />
          </div>
          <span className="text-2xl font-black tabular-nums mt-2" dir="ltr">{formatNum(subscribers.length)}</span>
        </div>

        <div
          onClick={() => setFilterStatus('unpaid')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm ${
            filterStatus === 'unpaid'
              ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30'
              : 'bg-white dark:bg-[#131E38] border-slate-200 dark:border-blue-900/50 hover:border-rose-500 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">غير مسدد</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-black tabular-nums mt-2 text-rose-500" dir="ltr">{formatNum(countUnpaid)}</span>
        </div>

        <div
          onClick={() => setFilterStatus('paid')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm ${
            filterStatus === 'paid'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-white dark:bg-[#131E38] border-slate-200 dark:border-blue-900/50 hover:border-emerald-500 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">مسدد بالكامل</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-black tabular-nums mt-2 text-emerald-500" dir="ltr">{formatNum(countPaid)}</span>
        </div>

        <div
          onClick={() => setFilterStatus('partial')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm ${
            filterStatus === 'partial'
              ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/30'
              : 'bg-white dark:bg-[#131E38] border-slate-200 dark:border-blue-900/50 hover:border-amber-500 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">مسدد جزئياً</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black tabular-nums mt-2 text-amber-500" dir="ltr">{formatNum(countPartial)}</span>
        </div>

        <div
          onClick={() => setFilterStatus('free')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1 ${
            filterStatus === 'free'
              ? 'bg-slate-700 border-slate-600 text-white shadow-lg shadow-slate-700/30'
              : 'bg-white dark:bg-[#131E38] border-slate-200 dark:border-blue-900/50 hover:border-slate-500 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">مجاني (إعفاء)</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-black tabular-nums mt-2 text-slate-400" dir="ltr">{formatNum(countFree)}</span>
        </div>
      </div>

      {/* 2. شريط البحث والتحكم */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث سريع باسم المشترك، الكود، رقم الهاتف، أو رقم الجوزة..."
            className="w-full bg-white dark:bg-[#131E38] border-2 border-blue-500/40 focus:border-blue-500 rounded-2xl pr-14 pl-5 py-4 text-sm font-black text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none shadow-md transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-4 rounded-2xl bg-white dark:bg-[#131E38] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-blue-900/50 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span>طباعة الكشف</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSubscriberModal()}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مشترك</span>
          </button>
        </div>
      </div>

      {/* 3. شريط الكابينات والخطوط يدعم السحب الكامل (ماوس + لمس) */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none whitespace-nowrap select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <button
          type="button"
          onClick={() => setSelectedLine('all')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 shadow-xs ${
            selectedLine === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white dark:bg-[#131E38] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-900/50'
          }`}
        >
          الكل
        </button>

        {lines.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => setSelectedLine(l.name)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 shadow-xs ${
              selectedLine === l.name
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-white dark:bg-[#131E38] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-900/50'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* جدول المشتركين مع الخطوط الطولية البارزة للفصل بين الأعمدة */}
      <div className="bg-white dark:bg-[#131E38] rounded-3xl border border-slate-200 dark:border-blue-900/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-right border-collapse">
            
            {/* رأس الجدول الثابت */}
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#0c1427] border-b-2 border-slate-300 dark:border-blue-900 text-slate-700 dark:text-slate-200 text-xs font-black shadow-sm">
              <tr>
                <th className="py-4 px-6 w-36 text-center sticky top-0 bg-slate-100 dark:bg-[#0c1427] border-l border-slate-300 dark:border-blue-900/60">
                  كود المشترك
                </th>
                <th className="py-4 px-6 text-center sticky top-0 bg-slate-100 dark:bg-[#0c1427] border-l border-slate-300 dark:border-blue-900/60">
                  اسم المشترك
                </th>
                <th className="py-4 px-6 w-32 text-center sticky top-0 bg-slate-100 dark:bg-[#0c1427] border-l border-slate-300 dark:border-blue-900/60">
                  امبير
                </th>
                <th className="py-4 px-6 w-36 text-center sticky top-0 bg-slate-100 dark:bg-[#0c1427]">
                  الإجراءات
                </th>
              </tr>
            </thead>

            {/* صفوف المشتركين */}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400 font-bold">
                    لا توجد نتائج مطابقة للبحث أو الفلاتر المحددة.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map(sub => {
                  const isPaid = sub.paymentStatus === 'paid';
                  const isPartial = sub.paymentStatus === 'partial';
                  const isFree = sub.paymentStatus === 'free';
                  const isUnpaid = sub.paymentStatus === 'unpaid';

                  // صندوق كود المشترك الملون حسب الحالة
                  const codeBoxClass = isUnpaid
                    ? 'bg-rose-600 text-white font-black shadow-md'
                    : isPartial
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                    : isFree
                    ? 'bg-slate-600 text-white font-black shadow-md'
                    : isPaid
                    ? 'bg-emerald-600 text-white font-black shadow-md'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black border border-slate-300 shadow-xs';

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onOpenSubscriberModal(sub)}
                      className="transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group"
                    >
                      {/* كود المشترك */}
                      <td className="py-4 px-6 text-center font-mono border-l border-slate-200 dark:border-slate-800/80">
                        <div className={`py-2 px-3 rounded-xl text-center text-xs tracking-wider inline-block min-w-[85px] ${codeBoxClass}`}>
                          {sub.code}
                        </div>
                      </td>

                      {/* اسم المشترك */}
                      <td className="py-4 px-6 text-center border-l border-slate-200 dark:border-slate-800/80">
                        <span className="font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                          {sub.fullName}
                        </span>
                      </td>

                      {/* عدد الأمبيرات */}
                      <td className="py-4 px-6 text-center font-black text-sm tabular-nums text-slate-800 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800/80" dir="ltr">
                        {formatNum(sub.amperes)} A
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`هل تريد حذف المشترك ${sub.fullName}؟ لا يمكن التراجع عن هذه العملية.`)) {
                              onDeleteSubscriber(sub.id);
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-black transition-all cursor-pointer"
                          title="حذف المشترك"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
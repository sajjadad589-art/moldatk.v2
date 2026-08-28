import React, { useState, useRef, useEffect } from 'react';
import { Search, LogOut, UserPlus, Zap, MapPin, Wifi, WifiOff, Smartphone, Monitor, CheckCircle2, CreditCard } from 'lucide-react';
import { PaymentMethodModal, PaymentExecutionData } from './PaymentMethodModal';
import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, Collector, SubscriberInvoice } from '../types';
import { calculateSubscriberBill } from '../utils/formatters';

interface POSQuickViewProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  collectorName: string;
  collectors?: Collector[];
  lines: { id: string; name: string }[];
  onSaveSubscriber: (sub: Subscriber) => void;
  onAddAuditLog: (entry: any) => void;
  onLogout: () => void;
  onOpenReceiptModal: (sub: Subscriber, inv: any, autoPrint: boolean) => void;
  onOpenNewSubscriberModal?: () => void;
  viewMode?: 'mobile' | 'desktop' | 'auto';
  onChangeViewMode?: (mode: 'mobile' | 'desktop' | 'auto') => void;
}

export const POSQuickView: React.FC<POSQuickViewProps> = ({
  subscribers,
  pricingTiers,
  generatorSpecs,
  collectorName,
  collectors = [],
  lines,
  onSaveSubscriber,
  onAddAuditLog,
  onLogout,
  onOpenReceiptModal,
  onOpenNewSubscriberModal,
  viewMode = 'desktop',
  onChangeViewMode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('all');
  const [showPaidList, setShowPaidList] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [paymentSubscriber, setPaymentSubscriber] = useState<Subscriber | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{ name: string; amount: number; method: string } | null>(null);

  const effectiveCollectors: Collector[] = collectors.length > 0
    ? collectors
    : [{
        id: 'current-collector',
        name: collectorName || 'المحاسب',
        phone: '',
        passcode: '',
        assignedLineName: '',
        role: 'collector',
        isActive: true,
      }];

  const handleConfirmPayment = (data: PaymentExecutionData) => {
    const sub = subscribers.find(s => s.id === data.subscriberId);
    if (!sub) return;

    const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
    const totalAmount = sub.amountDue > 0 ? sub.amountDue : calc.total;

    if (data.method === 'unpaid') {
      const updated: Subscriber = {
        ...sub,
        paymentStatus: 'unpaid',
        amountPaid: 0,
        amountDue: totalAmount,
      };
      onSaveSubscriber(updated);
      onAddAuditLog({
        category: 'cancellation',
        title: 'إلغاء تسديد',
        details: `إرجاع المشترك "${sub.fullName}" (${sub.code || sub.subscriberCode}) إلى غير مسدد`,
        entityId: sub.id,
        entityName: `${sub.fullName} (${sub.code || sub.subscriberCode})`,
        actorName: data.collectorName || collectorName || 'المحاسب',
        cancellationReason: data.cancellationReason,
      });
      setPaymentSubscriber(null);
      return;
    }

    const status: Subscriber['paymentStatus'] = data.method === 'full'
      ? 'paid'
      : data.method === 'partial'
      ? 'partial'
      : 'free';

    const now = new Date();
    const invoice: SubscriberInvoice = {
      id: `inv-${Date.now()}`,
      subscriberId: sub.id,
      receiptNumber: `REC-${sub.code || sub.subscriberCode || 'MW'}-${Date.now().toString().slice(-4)}`,
      monthId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthNameAr: `شهر ${now.getMonth() + 1} (${now.toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })})`,
      issueDate: now.toISOString().split('T')[0],
      paymentDate: now.toISOString(),
      amperes: sub.amperes,
      tier: sub.tier,
      pricePerAmpere: calc.pricePerAmpere,
      fixedFee: calc.fixedFee,
      totalAmount,
      paidAmount: data.amountPaid,
      remainingAmount: data.remainingAmount,
      status,
      collectorName: data.collectorName || collectorName || 'المحاسب',
      notes: data.notes,
    };

    const updated: Subscriber = {
      ...sub,
      paymentStatus: status,
      amountDue: totalAmount,
      amountPaid: data.amountPaid,
      lastPaymentDate: now.toISOString(),
      isExempted: status === 'free',
      exemptReason: status === 'free' ? data.freeReason : sub.exemptReason,
      invoicesHistory: [invoice, ...(sub.invoicesHistory || [])],
    };

    // الحفظ أولاً، والطباعة تأتي بعد نجاح التسديد فقط.
    onSaveSubscriber(updated);
    onAddAuditLog({
      category: 'payment',
      title: status === 'paid' ? 'تسديد كامل' : status === 'partial' ? 'تسديد جزئي' : 'إعفاء مجاني',
      details: status === 'free'
        ? `تم إعفاء المشترك "${sub.fullName}" (${sub.code || sub.subscriberCode}) مجاناً`
        : `تم تسديد المشترك "${sub.fullName}" (${sub.code || sub.subscriberCode}) بمبلغ ${data.amountPaid.toLocaleString('en-US')} ${generatorSpecs.currency || 'د.ع'}`,
      entityId: sub.id,
      entityName: `${sub.fullName} (${sub.code || sub.subscriberCode})`,
      actorName: data.collectorName || collectorName || 'المحاسب',
      amount: data.amountPaid,
    });

    setPaymentSubscriber(null);
    setPaymentSuccess({ name: sub.fullName, amount: data.amountPaid, method: data.method });

    if (data.autoPrintReceipt) {
      window.setTimeout(() => {
        onOpenReceiptModal(updated, invoice, true);
      }, 900);
    }

    window.setTimeout(() => setPaymentSuccess(null), 1800);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const filteredSubs = subscribers.filter(sub => {
    if (selectedLineFilter !== 'all' && sub.lineId !== selectedLineFilter) return false;
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchName = sub.fullName.toLowerCase().includes(query);
      const matchPhone = sub.phone?.toLowerCase().includes(query);
      const matchCode = sub.subscriberCode?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
    return true;
  });

  const totalCollected = subscribers.reduce((acc, sub) => {
    const paidInvoices = (sub.invoicesHistory || []).filter(inv => inv.status === 'paid');
    return acc + paidInvoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
  }, 0);

  const totalUnpaid = subscribers.reduce((acc, sub) => {
    const unpaidInvoices = (sub.invoicesHistory || []).filter(inv => inv.status === 'unpaid' || inv.status === 'partial');
    return acc + unpaidInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - (inv.paidAmount || 0)), 0);
  }, 0);

  const paidSubscribersList = filteredSubs.filter(sub => sub.paymentStatus === 'paid');
  const unpaidSubscribersList = filteredSubs.filter(sub => sub.paymentStatus !== 'paid');

  const activeTierPrice = pricingTiers[0]?.pricePerAmpere || 0;

  return (
    <div className="min-h-screen bg-[#070d1e] text-white p-4 sm:p-6 font-['Cairo'] select-none flex justify-center" dir="rtl">
      <div className={`w-full ${viewMode === 'mobile' ? 'max-w-md border-x border-blue-900/40 shadow-2xl px-3' : 'max-w-6xl'} space-y-6 pb-12 transition-all`}>
        
        {/* الشريط العلوي */}
        <div className="flex items-center justify-between gap-2">
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>

          <div className="text-center truncate px-1">
            <h1 className="text-base sm:text-xl font-black text-amber-400 truncate">{generatorSpecs.generatorName || 'مولدتك'}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل'}</span>
            </div>

            {onChangeViewMode && (
              <button
                onClick={() => onChangeViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all cursor-pointer"
                title={viewMode === 'mobile' ? 'التحويل لوضع الحاسوب' : 'التحويل لوضع الهاتف'}
              >
                {viewMode === 'mobile' ? (
                  <>
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">حاسوب</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">هاتف</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* معلومات الجابي */}
        <div className="flex items-center justify-between bg-[#101b35] border border-blue-900/40 p-3.5 rounded-2xl shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold">
              👤
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">الجابي / المحاسب الميداني</span>
              <span className="text-xs font-black text-white">{collectorName}</span>
            </div>
          </div>

          <div className={`sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
            isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        {/* لوحة التحكم الميدانية */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-300">لوحة التحكم الميدانية</h2>
            {onOpenNewSubscriberModal && (
              <button
                onClick={onOpenNewSubscriberModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة مشترك جديد</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#101b35] border border-blue-900/40 p-3.5 rounded-3xl text-center space-y-1 shadow-md">
              <span className="text-[11px] text-slate-400 block">تم تحصيله</span>
              <span className="text-sm sm:text-base font-black text-emerald-400" dir="ltr">
                {totalCollected.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
              </span>
            </div>

            <div className="bg-[#101b35] border border-blue-900/40 p-3.5 rounded-3xl text-center space-y-1 shadow-md">
              <span className="text-[11px] text-slate-400 block">مبالغ غير مسددة</span>
              <span className="text-sm sm:text-base font-black text-rose-400" dir="ltr">
                {totalUnpaid.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
              </span>
            </div>

            <div className="bg-[#101b35] border border-blue-900/40 p-3.5 rounded-3xl text-center space-y-1 shadow-md">
              <span className="text-[11px] text-slate-400 block">سعر الأمبير</span>
              <span className="text-sm sm:text-base font-black text-amber-400" dir="ltr">
                {activeTierPrice.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
              </span>
            </div>

            <div
              onClick={() => setShowPaidList(!showPaidList)}
              className="bg-[#101b35] border border-emerald-500/30 hover:border-emerald-500/60 p-3.5 rounded-3xl text-center space-y-1 shadow-md cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>المسددين</span>
              </div>
              <span className="text-base sm:text-lg font-black text-emerald-300">
                {paidSubscribersList.length} مشترك
              </span>
            </div>
          </div>
        </div>

        {showPaidList && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-3xl p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>قائمة المشتركين الذين سددوا ({paidSubscribersList.length})</span>
              </h4>
              <button
                onClick={() => setShowPaidList(false)}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                إخفاء القائمة
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {paidSubscribersList.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">لا يوجد مشتركين مسددين حالياً.</div>
              ) : (
                paidSubscribersList.map(sub => {
                  const lineObj = lines.find(l => l.id === sub.lineId);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => onOpenReceiptModal(sub, null, true)}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#101b35] border border-emerald-500/25 hover:border-emerald-500/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-xs font-black text-white block">{sub.fullName}</span>
                          <span className="text-[10px] text-slate-400">{lineObj?.name || 'الخط الرئيسي'} • {sub.amperes} أمبير</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400">تم التسديد</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>كابينات المولدة (اسحب بالماوس أو اللمس للتنقل):</span>
          </span>

          <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none cursor-grab active:cursor-grabbing select-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setSelectedLineFilter('all')}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                selectedLineFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-[#101b35] text-slate-300 hover:bg-[#18264a] border border-blue-900/30'
              }`}
            >
              الكل
            </button>
            {lines.map(line => (
              <button
                key={line.id}
                onClick={() => setSelectedLineFilter(line.id)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  selectedLineFilter === line.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-[#101b35] text-slate-300 hover:bg-[#18264a] border border-blue-900/30'
                }`}
              >
                {line.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-4 top-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم المشترك، الاسم، الهاتف، أو الكابينة..."
            className="w-full bg-[#101b35] border border-blue-900/40 rounded-2xl px-4 py-3.5 pr-11 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400">
            المشتركين غير المسددين أو الذين عليهم ديون ({unpaidSubscribersList.length})
          </h3>

          {unpaidSubscribersList.length === 0 ? (
            <div className="text-center py-12 bg-[#101b35]/50 border border-blue-900/20 rounded-3xl text-slate-400 text-xs font-bold space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
              <p>ممتاز! جميع المشتركين ضمن هذه التصفية قاموا بتسديد اشتراكاتهم بالكامل.</p>
            </div>
          ) : (
            unpaidSubscribersList.map(sub => {
              const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
              const dueAmount = sub.amountDue > 0 ? sub.amountDue : calc.total;
              const lineObj = lines.find(l => l.id === sub.lineId);
              return (
                <div
                  key={sub.id}
                  onClick={() => setPaymentSubscriber(sub)}
                  className="relative overflow-hidden flex items-center justify-between p-4.5 rounded-3xl bg-[#101b35] border border-blue-900/40 shadow-lg hover:border-blue-500/80 hover:bg-[#152342] transition-all cursor-pointer group"
                >
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500 rounded-l" />

                  <div className="space-y-1.5 pr-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">{sub.fullName}</span>
                      <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-800/40">
                        كود : {sub.subscriberCode || 'MW-000'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>{lineObj ? lineObj.name : 'الخط الرئيسي'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{sub.amperes} أمبير</span>
                      </span>
                      {sub.phone && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{sub.phone}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-amber-400 tabular-nums" dir="ltr">
                      {dueAmount.toLocaleString()} {generatorSpecs.currency || 'د.ع'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaymentSubscriber(sub);
                      }}
                      className="min-w-[104px] min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white text-sm font-black border-2 border-blue-300/60 ring-2 ring-blue-500/20 shadow-lg shadow-blue-950/40 transition-all active:scale-95 cursor-pointer"
                      aria-label={`تسديد اشتراك ${sub.fullName}`}
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      <span>تسديد الآن</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>


        <PaymentMethodModal
          isOpen={Boolean(paymentSubscriber)}
          onClose={() => setPaymentSubscriber(null)}
          subscriber={paymentSubscriber}
          pricingTiers={pricingTiers}
          collectors={effectiveCollectors}
          currency={generatorSpecs.currency || 'د.ع'}
          onConfirmPayment={handleConfirmPayment}
        />

        {paymentSuccess && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] px-4" dir="rtl">
            <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-2xl border border-emerald-100 px-6 py-8 text-center animate-in zoom-in-95 fade-in duration-200">
              <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center ring-8 ring-emerald-50">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-emerald-700 mb-2">تم التسديد بنجاح</h3>
              <p className="text-sm font-bold text-slate-700 leading-7">
                تم تسديد المشترك <span className="text-slate-950">{paymentSuccess.name}</span>
              </p>
              <p className="mt-1 text-base font-black text-blue-700">
                {paymentSuccess.method === 'free'
                  ? 'إعفاء مجاني — 0 د.ع'
                  : `مبلغ ${paymentSuccess.amount.toLocaleString('en-US')} ${generatorSpecs.currency || 'د.ع'}`}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
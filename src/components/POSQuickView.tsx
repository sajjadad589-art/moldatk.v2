import { hasMonthlyPricing, NO_TARIFF_LABEL } from '../utils/pricingAvailability';
import React, { useState, useRef, useEffect } from 'react';
import { Search, LogOut, UserPlus, Zap, MapPin, Wifi, WifiOff, Smartphone, Monitor, CheckCircle2, CreditCard } from 'lucide-react';
import { PaymentMethodModal, PaymentExecutionData } from './PaymentMethodModal';
import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, Collector, CollectorPermissions, SubscriberInvoice } from '../types';
import { calculateSubscriberBill } from '../utils/formatters';
import { getSubscriberFinancialRow } from '../utils/authoritativeAccounting';
import { applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';

interface POSQuickViewProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  collectorName: string;
  activeMonthId?: string;
  activeMonthNameAr?: string;
  collectorPermissions?: CollectorPermissions;
  assignedLineId?: string;
  collectors?: Collector[];
  lines: { id: string; name: string }[];
  allowedLineIds?: string[];
  assignedAllLines?: boolean;
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
  activeMonthId = getMonthId(),
  activeMonthNameAr,
  collectorPermissions,
  assignedLineId,
  collectors = [],
  lines,
  allowedLineIds = [],
  assignedAllLines = false,
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

  const permissions: CollectorPermissions = {
    canCollectPayments: true,
    canCancelPayments: false,
    canAddSubscribers: false,
    canEditSubscribers: false,
    canDeleteSubscribers: false,
    canApplyFreeExemption: false,
    canPrintReceipts: true,
    canViewFinancialReports: false,
    canAccessSystemSettings: false,
    ...(collectorPermissions || {}),
  };

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
    if (!hasMonthlyPricing(pricingTiers)) return;
    const sub = subscribers.find(s => s.id === data.subscriberId);
    if (!sub) return;

    const now = new Date();
    const monthId = activeMonthId || getMonthId(now);
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(sub, pricingTiers, monthId, monthName, now.toISOString().slice(0, 10));

    if (data.method === 'unpaid') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free'
        ? { ...inv, paidAmount: 0, remainingAmount: Number(inv.totalAmount || 0), status: 'unpaid' as const, paymentDate: undefined }
        : inv);
      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const current = invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
      const updated: Subscriber = {
        ...sub,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        paymentStatus: totalDebtAfter === 0 ? 'paid' : 'unpaid',
        amountDue: totalDebtAfter,
        amountPaid: Number(current?.paidAmount || 0),
      };
      onSaveSubscriber(updated);
      onAddAuditLog({
        category: 'cancellation',
        title: 'إلغاء تسديد الشهر الحالي',
        details: 'تم إرجاع حساب الشهر الحالي للمشترك "' + sub.fullName + '" إلى غير مسدد مع إبقاء سجل الديون التاريخي',
        entityId: sub.id,
        entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
        actorName: data.collectorName || collectorName || 'المحاسب',
        cancellationReason: data.cancellationReason,
      });
      setPaymentSubscriber(null);
      return;
    }

    if (data.method === 'free') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled'
        ? {
            ...inv,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            status: 'free' as const,
            paymentDate: undefined,
            notes: data.freeReason ? ('إعفاء الشهر الحالي: ' + data.freeReason) : 'إعفاء الشهر الحالي',
          }
        : inv);
      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const updated: Subscriber = {
        ...sub,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        paymentStatus: totalDebtAfter === 0 ? 'free' : 'unpaid',
        amountDue: totalDebtAfter,
        amountPaid: 0,
        exemptReason: data.freeReason || sub.exemptReason,
      };
      onSaveSubscriber(updated);
      onAddAuditLog({
        category: 'payment',
        title: 'إعفاء مجاني للشهر الحالي',
        details: 'تم إعفاء شهر ' + monthId + ' للمشترك "' + sub.fullName + '" بدون حذف أي دين سابق',
        entityId: sub.id,
        entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
        actorName: data.collectorName || collectorName || 'المحاسب',
        amount: 0,
      });
      setPaymentSubscriber(null);
      setPaymentSuccess({ name: sub.fullName, amount: 0, method: data.method });
      window.setTimeout(() => setPaymentSuccess(null), 1500);
      return;
    }

    // COLLECTOR_LUMP_SETTLEMENT_V1
    if (data.method === 'lump') {
      const current = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');
      if (!current || String(current.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;
      const originalTotal = Math.max(0, Number(current.totalAmount || 0));
      const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));
      const remainingBefore = getInvoiceRemaining(current);
      const received = Math.min(remainingBefore, Math.max(0, Number(data.amountPaid || 0)));
      if (remainingBefore <= 0 || received <= 0) return;
      const effectiveTotal = alreadyPaid + received;
      const discount = Math.max(0, originalTotal - effectiveTotal);
      const marker = 'MOLDATK_LUMP_SETTLEMENT|original=' + originalTotal + '|settled=' + effectiveTotal + '|discount=' + discount + '|received=' + received;
      const settledCurrent: SubscriberInvoice = { ...current, totalAmount: effectiveTotal, paidAmount: effectiveTotal, remainingAmount: 0, status: 'paid', paymentDate: now.toISOString(), notes: marker };
      const invoices = ensured.invoices.map(inv => inv.id === current.id ? settledCurrent : inv);
      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const updated: Subscriber = { ...sub, invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)), paymentStatus: totalDebtAfter === 0 ? 'paid' : 'partial', amountDue: totalDebtAfter, amountPaid: effectiveTotal, lastPaymentDate: now.toISOString() };
      const receiptInvoice: SubscriberInvoice = { ...settledCurrent, id: 'receipt-lump-' + sub.id + '-' + Date.now(), receiptNumber: 'REC-' + (sub.code || sub.subscriberCode || 'MW') + '-' + Date.now().toString().slice(-6), totalAmount: received, paidAmount: received, remainingAmount: totalDebtAfter, status: totalDebtAfter === 0 ? 'paid' : 'partial', collectorName: data.collectorName || collectorName || 'المحاسب', previousDebtBefore: Math.max(0, Number(sub.amountDue || 0) - remainingBefore), currentCharge: effectiveTotal, totalBeforePayment: originalTotal, appliedToPreviousDebt: 0, appliedToCurrentMonth: received, totalOutstandingAfter: totalDebtAfter, paymentDate: now.toISOString(), notes: marker };
      onSaveSubscriber(updated);
      onAddAuditLog({ category: 'payment', title: 'تسديد مقطوع', details: 'الاستحقاق الأصلي ' + originalTotal.toLocaleString('en-US') + ' | المستلم ' + received.toLocaleString('en-US') + ' | فرق التسوية ' + discount.toLocaleString('en-US'), entityId: sub.id, entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')', actorName: data.collectorName || collectorName || 'المحاسب', amount: received });
      setPaymentSubscriber(null);
      setPaymentSuccess({ name: sub.fullName, amount: received, method: data.method });
      if (data.autoPrintReceipt) window.setTimeout(() => onOpenReceiptModal(updated, receiptInvoice, true), 650);
      window.setTimeout(() => setPaymentSuccess(null), 1800);
      return;
    }

    // COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2
    // A full/cash payment always settles the real ledger balance, not a stale UI value.
    const outstandingBefore = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const requestedPayment = Math.max(0, Number(data.amountPaid || 0));
    const paymentAmount = data.method === 'full'
      ? outstandingBefore
      : Math.min(outstandingBefore, requestedPayment);
    if (paymentAmount <= 0) return;

    const allocation = applyPaymentOldestFirst(sub, pricingTiers, paymentAmount, now, monthId, monthName);
    const currentInvoice = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
    const anyPartial = allocation.invoices.some(inv => Number(inv.paidAmount || 0) > 0 && getInvoiceRemaining(inv) > 0);
    const updated: Subscriber = {
      ...sub,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : (anyPartial || paymentAmount > 0 ? 'partial' : 'unpaid'),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(currentInvoice?.paidAmount || 0),
      lastPaymentDate: now.toISOString(),
    };

    const receiptInvoice: SubscriberInvoice = {
      ...(currentInvoice || ensured.currentInvoice),
      id: 'receipt-' + sub.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (sub.code || sub.subscriberCode || 'MW') + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: paymentAmount,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      collectorName: data.collectorName || collectorName || 'المحاسب',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
      notes: data.notes,
    };

    // Save first; receipt is a snapshot only and is NOT inserted as another monthly charge.
    onSaveSubscriber(updated);
    onAddAuditLog({
      category: 'payment',
      title: allocation.totalDebtAfter === 0 ? 'تسديد كامل' : 'تسديد جزئي',
      details: 'استلام ' + paymentAmount.toLocaleString('en-US') + ' ' + (generatorSpecs.currency || 'د.ع')
        + ' من "' + sub.fullName + '" | دين سابق: ' + allocation.appliedToPreviousDebt.toLocaleString('en-US')
        + ' | الشهر الحالي: ' + allocation.appliedToCurrentMonth.toLocaleString('en-US')
        + ' | المتبقي: ' + allocation.totalDebtAfter.toLocaleString('en-US'),
      entityId: sub.id,
      entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
      actorName: data.collectorName || collectorName || 'المحاسب',
      amount: paymentAmount,
    });

    setPaymentSubscriber(null);
    setPaymentSuccess({ name: sub.fullName, amount: paymentAmount, method: data.method });

    if (data.autoPrintReceipt) {
      window.setTimeout(() => onOpenReceiptModal(updated, receiptInvoice, true), 650);
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

  const hasExplicitAssignment = assignedAllLines || allowedLineIds.length > 0;
  const accessibleLines = assignedAllLines || !hasExplicitAssignment
    ? lines
    : lines.filter(line => allowedLineIds.includes(line.id));
  const accessibleLineIds = new Set(accessibleLines.map(line => line.id));
  const accessibleSubscribers = assignedAllLines || !hasExplicitAssignment
    ? subscribers
    : subscribers.filter(sub => {
        const resolvedLineId = sub.lineId || lines.find(line => line.name === (sub.lineName || sub.line || ''))?.id;
        return Boolean(resolvedLineId && accessibleLineIds.has(resolvedLineId));
      });

  // COLLECTOR_HIDE_FREE_SUBSCRIBERS_V2
  // Free/exempt subscribers require no collection and never appear for collectors.
  const collectibleSubscribers = accessibleSubscribers.filter(sub =>
    sub.paymentStatus !== 'free' && sub.isExempted !== true && sub.tier !== 'free'
  );

  const filteredSubs = collectibleSubscribers.filter(sub => {
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
    if (assignedLineId && sub.lineId !== assignedLineId) return false;
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

  // COLLECTOR_OWNER_ACCOUNTING_PARITY_V2
  // Same classifier used by MobileDashboard/DashboardView/WalletView. The collector
  // only narrows the population by assigned cabinets; payment status semantics stay identical.
  const billingCycleActive = pricingTiers.some(t =>
    t.type !== 'free' && (Number(t.pricePerAmpere || 0) > 0 || Number(t.fixedFee || 0) > 0)
  );
  const collectorAccountingRows = collectibleSubscribers.map(sub => {
    const row = getSubscriberFinancialRow(sub, pricingTiers, activeMonthId);
    return {
      sub,
      billed: row.bill,
      collected: row.paid,
      outstanding: row.outstanding,
      status: row.status,
      isFree: row.isFree,
    };
  });
  type CollectorAccountingRow = (typeof collectorAccountingRows)[number];
  const collectorAccountingById = new Map<string, CollectorAccountingRow>(
    collectorAccountingRows.map(row => [row.sub.id, row] as const)
  );

  const cabinetAccountingRows = selectedLineFilter === 'all'
    ? collectorAccountingRows
    : collectorAccountingRows.filter(row => row.sub.lineId === selectedLineFilter);
  const dashboardAccountingRows = billingCycleActive ? cabinetAccountingRows : [];

  const totalCollected = dashboardAccountingRows.reduce((sum, row) => sum + row.collected, 0);
  const totalUnpaid = dashboardAccountingRows.reduce((sum, row) => sum + row.outstanding, 0);
  const dashboardPaidSubscribers = dashboardAccountingRows.filter(row =>
    row.status === 'paid' && row.outstanding === 0 && row.billed > 0
  );

  const paidSubscribersList = billingCycleActive ? filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && row.status === 'paid' && row.outstanding === 0 && row.billed > 0);
  }) : [];
  const unpaidSubscribersList = billingCycleActive ? filteredSubs.filter(sub => {
    const row = collectorAccountingById.get(sub.id);
    return Boolean(row && (row.outstanding > 0 || row.status === 'unpaid' || row.status === 'partial'));
  }) : [];

  const activeTier = pricingTiers.find(t => t.type === 'normal')
    || pricingTiers.find(t => t.type !== 'free');
  const activeTierPrice = Math.max(0, Number(activeTier?.pricePerAmpere || 0));

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

          <div className="flex items-center justify-center gap-1.5 min-w-0 px-1">
            <h1 className="text-base sm:text-xl font-black text-[#F2B544] truncate">{generatorSpecs.generatorName || 'مولدتك'}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>{isOnline ? 'متصل' : 'غير متصل'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={`hidden items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
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

          <div className={`hidden items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
            isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        {/* لوحة التحكم الميدانية */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-300">لوحة التحكم الميدانية</h2>
            {onOpenNewSubscriberModal && permissions.canAddSubscribers && (
              <button
                onClick={onOpenNewSubscriberModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-[#0B1F3B] text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
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
                {totalCollected.toLocaleString('en-US')} {generatorSpecs.currency || 'د.ع'}
              </span>
            </div>

            <div className="bg-[#101b35] border border-blue-900/40 p-3.5 rounded-3xl text-center space-y-1 shadow-md">
              <span className="text-[11px] text-slate-400 block">مبالغ غير مسددة</span>
              <span className="text-sm sm:text-base font-black text-rose-400" dir="ltr">
                {totalUnpaid.toLocaleString('en-US')} {generatorSpecs.currency || 'د.ع'}
              </span>
            </div>

            <div className="bg-[#101b35] border border-blue-900/40 p-3.5 rounded-3xl text-center space-y-1 shadow-md">
              <span className="text-[11px] text-slate-400 block">سعر الأمبير</span>
              <span className="text-sm sm:text-base font-black text-[#F2B544]" dir="ltr">
                {activeTierPrice.toLocaleString('en-US')} {generatorSpecs.currency || 'د.ع'}
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
                {dashboardPaidSubscribers.length} مشترك
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
                      className="flex items-center justify-between p-3 rounded-2xl bg-emerald-700 border-2 border-emerald-400 hover:bg-emerald-600 cursor-pointer transition-all shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-xs font-black text-white block">{sub.fullName}</span>
                          <span className="text-[10px] text-emerald-50">{lineObj?.name || 'الخط الرئيسي'} • {sub.amperes} أمبير</span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">مسدد</span>
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
                  ? 'bg-[#0B1F3B] text-white shadow-lg shadow-blue-600/30'
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
                    ? 'bg-[#0B1F3B] text-white shadow-lg shadow-blue-600/30'
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
              <p>{hasMonthlyPricing(pricingTiers) ? 'ممتاز! جميع المشتركين ضمن هذه التصفية قاموا بتسديد اشتراكاتهم بالكامل.' : NO_TARIFF_LABEL + ' — التسديد متوقف'}</p>
            </div>
          ) : (
            unpaidSubscribersList.map(sub => {
              const accountingRow = collectorAccountingById.get(sub.id);
              const dueAmount = accountingRow
                ? accountingRow.outstanding
                : Math.max(0, Number(sub.amountDue || calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total || 0));
              const lineObj = lines.find(l => l.id === sub.lineId);
              return (
                <div
                  key={sub.id}
                  data-design="collector-approved-card-v3"
                  onClick={() => { if (permissions.canCollectPayments || permissions.canCancelPayments || permissions.canApplyFreeExemption) setPaymentSubscriber(sub); }}
                  className="relative overflow-hidden rounded-[26px] border border-rose-300/60 bg-gradient-to-r from-[#c4142d] via-[#aa1028] to-[#7a0b20] px-4 py-5 sm:px-6 sm:py-6 shadow-[0_10px_30px_rgba(120,10,32,0.34)] active:scale-[0.99] transition-transform cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPaymentSubscriber(sub); }}
                  aria-label={`فتح تسديد المشترك ${sub.fullName}`}
                >
                  <div className="grid grid-cols-[1.25fr_1fr_0.72fr] items-center divide-x divide-white/20" dir="rtl">
                    <div className="min-w-0 px-3 sm:px-4 text-right">
                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">اسم المشترك</span>
                      <span className="mt-1 block truncate text-[22px] sm:text-[28px] font-black leading-tight text-white">{sub.fullName}</span>
                    </div>

                    <div className="px-3 sm:px-4 text-center">
                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">المبلغ المطلوب</span>
                      <span className="mt-1 block whitespace-nowrap text-[21px] sm:text-[27px] font-black leading-tight text-white tabular-nums" dir="ltr">{dueAmount.toLocaleString('en-US')} {generatorSpecs.currency || 'د.ع'}</span>
                    </div>

                    <div className="px-3 sm:px-4 text-center">
                      <span className="block text-[12px] sm:text-sm font-bold text-white/75">الأمبير</span>
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <Zap className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 fill-amber-400 text-[#F2B544]" />
                        <span className="text-[24px] sm:text-[30px] font-black leading-none text-white tabular-nums">{sub.amperes}</span>
                      </div>
                    </div>
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

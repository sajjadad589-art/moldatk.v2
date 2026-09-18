import { hasMonthlyPricing, NO_TARIFF_LABEL, suspendSubscriberBilling } from '../utils/pricingAvailability';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  History,
  Layers,
  MessageCircle,
  Printer,
  Sliders,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, LineDistribution, AuditLogEntry, SubscriberInvoice, MonthlyTariffRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { applyLumpSettlementAllDebt, applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';

interface SubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberToEdit: Subscriber | null;
  pricingTiers: SubscriptionTierPricing[];
  monthlyTariffs?: MonthlyTariffRecord[];
  activeMonthId?: string;
  activeMonthNameAr?: string;
  lines: LineDistribution[];
  onSaveSubscriber: (subscriber: Subscriber) => void;
  onDeleteSubscriber?: (subId: string) => void;
  onTogglePaymentStatus?: (subId: string) => void;
  onOpenReceiptModal?: (sub: Subscriber, invoice?: SubscriberInvoice, autoPrint?: boolean) => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  isReadOnlyAmperes?: boolean;
}

const paymentStatusLabel = (status: Subscriber['paymentStatus']) => {
  if (status === 'paid') return 'مسدد';
  if (status === 'partial') return 'مسدد جزئياً';
  if (status === 'free') return 'إعفاء';
  return 'غير مسدد';
};

const paymentStatusClass = (status: Subscriber['paymentStatus']) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
  if (status === 'free') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
  return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
};

export const SubscriberModal: React.FC<SubscriberModalProps> = ({
  isOpen,
  onClose,
  subscriberToEdit,
  pricingTiers,
  monthlyTariffs = [],
  activeMonthId = getMonthId(),
  activeMonthNameAr,
  lines,
  onSaveSubscriber,
  onDeleteSubscriber,
  onOpenReceiptModal,
  onAddAuditLog,
  isReadOnlyAmperes = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeView, setActiveView] = useState<'profile' | 'history'>('profile');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [amperes, setAmperes] = useState<number>(5);
  const [tier, setTier] = useState<string>('normal');
  const [line, setLine] = useState<string>('');
  const [address, setAddress] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmUnpaidOpen, setIsConfirmUnpaidOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customError, setCustomError] = useState('');
  // AMPERE_DISCOUNT_SUBSCRIBER_UI_V1
  const [ampereDiscount, setAmpereDiscount] = useState<number>(0);
  const [ampereDiscountReason, setAmpereDiscountReason] = useState('');
  const [newDebtMode, setNewDebtMode] = useState<'none' | 'prior' | null>(null);
  const [priorDebtMonthId, setPriorDebtMonthId] = useState('');
  const [newDebtError, setNewDebtError] = useState('');
  const [customPaymentMode, setCustomPaymentMode] = useState<'partial' | 'lump'>('partial');

  useEffect(() => {
    if (!isOpen) return;
    if (subscriberToEdit) {
      setFullName(subscriberToEdit.fullName || '');
      setCode(subscriberToEdit.code || subscriberToEdit.subscriberCode || '');
      setPhone(subscriberToEdit.phone || '');
      setAmperes(subscriberToEdit.amperes || 5);
      setAmpereDiscount(Math.max(0, Number(subscriberToEdit.ampereDiscount || 0)));
      setAmpereDiscountReason(subscriberToEdit.ampereDiscountReason || '');
      setTier(subscriberToEdit.tier || pricingTiers[0]?.id || 'normal');
      setLine(subscriberToEdit.lineName || subscriberToEdit.line || lines[0]?.name || '');
      setIsEditing(false);
      setActiveView('profile');
    } else {
      setFullName('');
      setCode(`MW-${Math.floor(1000 + Math.random() * 9000)}`);
      setPhone('');
      setAmperes(5);
      setAmpereDiscount(0);
      setAmpereDiscountReason('');
      setTier(pricingTiers[0]?.id || 'normal');
      setLine(lines[0]?.name || '');
      setIsEditing(true);
      setActiveView('profile');
    }
    setIsConfirmDeleteOpen(false);
    setIsConfirmUnpaidOpen(false);
    setIsAdvancedOpen(false);
    setCustomAmount('');
    setCustomError('');
    setNewDebtMode(null);
    setPriorDebtMonthId('');
    setNewDebtError('');
    setCustomPaymentMode('partial');
  }, [isOpen, subscriberToEdit?.id]);

  const currentTierObj = useMemo(
    () => pricingTiers.find(p => p.id === tier || p.type === tier) || pricingTiers[0],
    [pricingTiers, tier]
  );

  const normalizedAmpereDiscount = useMemo(
    () => Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(ampereDiscount) || 0)),
    [amperes, ampereDiscount]
  );

  const currentCalc = useMemo(() => {
    const pricePerAmpere = Math.max(0, Number(currentTierObj?.pricePerAmpere || 0));
    const fixedFee = Math.max(0, Number(currentTierObj?.fixedFee || 0));
    const originalAmperes = Math.max(0, Number(amperes) || 0);
    const discountedAmperes = currentTierObj?.type === 'free' ? 0 : normalizedAmpereDiscount;
    const billedAmperes = currentTierObj?.type === 'free' ? 0 : Math.max(0, originalAmperes - discountedAmperes);
    const grossTotal = currentTierObj?.type === 'free' ? 0 : Math.max(0, originalAmperes * pricePerAmpere + fixedFee);
    const discountAmount = currentTierObj?.type === 'free' ? 0 : Math.max(0, discountedAmperes * pricePerAmpere);
    return {
      pricePerAmpere,
      fixedFee,
      originalAmperes,
      discountedAmperes,
      billedAmperes,
      grossTotal,
      discountAmount,
      total: currentTierObj?.type === 'free' ? 0 : Math.max(0, billedAmperes * pricePerAmpere + fixedFee),
    };
  }, [amperes, normalizedAmpereDiscount, currentTierObj]);

  const availableDebtTariffs = useMemo(
    () => [...monthlyTariffs].filter(m => Array.isArray(m.tiers) && m.tiers.length > 0).sort((a, b) => b.id.localeCompare(a.id)),
    [monthlyTariffs]
  );
  const selectedPriorTariff = useMemo(
    () => availableDebtTariffs.find(m => m.id === priorDebtMonthId),
    [availableDebtTariffs, priorDebtMonthId]
  );
  const selectedPriorTier = useMemo(
    () => selectedPriorTariff?.tiers.find(t => t.id === tier || t.type === tier || t.type === currentTierObj?.type),
    [selectedPriorTariff, tier, currentTierObj]
  );
  const selectedPriorDebtAmount = useMemo(() => {
    if (!selectedPriorTier) return 0;
    const original = Math.max(0, Number(amperes) || 0);
    const discounted = Math.min(original, Math.max(0, Number(ampereDiscount) || 0));
    return Math.max(0, (original - discounted) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));
  }, [amperes, ampereDiscount, selectedPriorTier]);

  const hasPricing = hasMonthlyPricing(pricingTiers);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMonthlyPricing(pricingTiers)) return;
    if (!fullName.trim()) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const selectedLine = lines.find(l => l.name === line);
    const selectedTierType = (currentTierObj?.type || tier) as Subscriber['tier'];
    const effectiveAmpereDiscount = selectedTierType === 'free'
      ? 0
      : Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(ampereDiscount) || 0));
    const effectiveDiscountReason = effectiveAmpereDiscount > 0 ? ampereDiscountReason.trim() : '';
    const isPermanentFree = selectedTierType === 'free';

    if (!subscriberToEdit) {
      if (!isPermanentFree && newDebtMode === null) {
        setNewDebtError('حدد أولاً هل على المشترك دين سابق أم لا.');
        return;
      }
      if (!isPermanentFree && newDebtMode === 'prior' && !priorDebtMonthId) {
        setNewDebtError(availableDebtTariffs.length ? 'اختر الشهر الذي يعود له الدين السابق.' : 'لا توجد تسعيرة شهرية محفوظة. أضف تسعيرة الشهر أولاً ثم أعد إضافة المشترك.');
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const id = 'sub-' + Date.now();
      const base: Subscriber = {
        id,
        code: code || ('MW-' + Math.floor(1000 + Math.random() * 9000)),
        subscriberCode: code || undefined,
        fullName: fullName.trim(),
        phone: phone.trim(),
        amperes,
        ampereDiscount: effectiveAmpereDiscount,
        ampereDiscountReason: effectiveDiscountReason || undefined,
        tier: selectedTierType,
        lineId: selectedLine?.id,
        lineName: line || lines[0]?.name || 'الخط الرئيسي',
        line: line || lines[0]?.name || 'الخط الرئيسي',
        paymentStatus: isPermanentFree ? 'free' : 'paid',
        amountDue: 0,
        amountPaid: 0,
        invoicesHistory: [],
        createdAt: nowIso,
        joiningDate: nowIso.slice(0, 10),
      };

      if (isPermanentFree) {
        const freeInvoice: SubscriberInvoice = {
          id: 'inv-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'free',
          notes: 'MOLDATK_ONBOARDING_FREE',
        };
        onSaveSubscriber({ ...base, paymentStatus: 'free', invoicesHistory: [freeInvoice] });
        setIsEditing(false);
        onClose();
        return;
      }

      // No prior debt means NO charge is created for the month in which the subscriber
      // was added. A hidden zero marker prevents older tariff logic from billing this month.
      if (newDebtMode === 'none') {
        const markerInvoice: SubscriberInvoice = {
          id: 'onboarding-zero-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'paid',
          notes: 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=no_prior_debt',
        };
        onSaveSubscriber({ ...base, paymentStatus: 'paid', amountDue: 0, amountPaid: 0, invoicesHistory: [markerInvoice] });
        setIsEditing(false);
        onClose();
        return;
      }

      const tariff = availableDebtTariffs.find(m => m.id === priorDebtMonthId);
      const tariffTier = tariff?.tiers.find(t => t.id === tier || t.type === tier || t.type === selectedTierType);
      if (!tariff || !tariffTier) {
        setNewDebtError('التسعيرة المختارة لا تحتوي فئة الاشتراك المطلوبة. عدّل التسعيرة أولاً.');
        return;
      }
      const priorOriginalAmperes = Math.max(0, Number(amperes) || 0);
      const priorDiscountedAmperes = Math.min(priorOriginalAmperes, effectiveAmpereDiscount);
      const priorBilledAmperes = Math.max(0, priorOriginalAmperes - priorDiscountedAmperes);
      const priorGrossAmount = Math.max(0, priorOriginalAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));
      const priorDiscountAmount = Math.max(0, priorDiscountedAmperes * Number(tariffTier.pricePerAmpere || 0));
      const debt = Math.max(0, priorBilledAmperes * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));
      if (debt <= 0) {
        setNewDebtError('قيمة تسعيرة الشهر المختار صفر. يجب إضافة تسعيرة صحيحة قبل تسجيل الدين.');
        return;
      }

      const debtInvoice: SubscriberInvoice = {
        id: 'inv-' + tariff.id + '-' + id,
        subscriberId: id,
        monthId: tariff.id,
        monthNameAr: tariff.monthNameAr,
        issueDate: nowIso.slice(0, 10),
        amperes,
        originalAmperes: priorOriginalAmperes,
        discountedAmperes: priorDiscountedAmperes,
        billedAmperes: priorBilledAmperes,
        grossAmountBeforeDiscount: priorGrossAmount,
        discountAmount: priorDiscountAmount,
        tier: selectedTierType,
        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),
        fixedFee: Number(tariffTier.fixedFee || 0),
        totalAmount: debt,
        paidAmount: 0,
        remainingAmount: debt,
        status: 'unpaid',
        notes: 'MOLDATK_PRIOR_DEBT_ONBOARDING|month=' + tariff.id,
      };
      const invoices: SubscriberInvoice[] = [debtInvoice];

      // If the historical debt belongs to an older month, the subscriber still must not
      // receive a second automatic charge for the current onboarding month.
      if (tariff.id !== monthId) {
        invoices.push({
          id: 'onboarding-zero-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'paid',
          notes: 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=prior_debt_other_month',
        });
      }

      onSaveSubscriber({
        ...base,
        paymentStatus: 'unpaid',
        amountDue: debt,
        amountPaid: 0,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      });
      setIsEditing(false);
      onClose();
      return;
    }

    // Existing subscriber edit: preserve every historical invoice and only re-price the
    // active unpaid month, exactly like the monthly-ledger finalizer did before this pass.
    const changes: string[] = [];
    if (subscriberToEdit.amperes !== amperes) changes.push('الأمبيرات: من (' + subscriberToEdit.amperes + ') إلى (' + amperes + ')');
    if (Number(subscriberToEdit.ampereDiscount || 0) !== effectiveAmpereDiscount) changes.push('خصم الأمبيرات: من (' + Number(subscriberToEdit.ampereDiscount || 0) + ') إلى (' + effectiveAmpereDiscount + ')');
    if (subscriberToEdit.tier !== selectedTierType) changes.push('تم تغيير فئة الاشتراك');
    if (subscriberToEdit.lineName !== line) changes.push('تم تغيير الكابينة');
    if (subscriberToEdit.phone !== phone) changes.push('تم تغيير الهاتف');
    const changesDetails = changes.length ? ('تم التعديل: ' + changes.join(' | ')) : ('حفظ التعديلات للمشترك "' + fullName + '"');

    const draft: Subscriber = {
      ...subscriberToEdit,
      code,
      subscriberCode: code,
      fullName: fullName.trim(),
      phone: phone.trim(),
      amperes,
      ampereDiscount: effectiveAmpereDiscount,
      ampereDiscountReason: effectiveDiscountReason || undefined,
      tier: selectedTierType,
      lineId: selectedLine?.id || subscriberToEdit.lineId,
      lineName: line || subscriberToEdit.lineName,
      line: line || subscriberToEdit.line,
    };
    const ensured = ensureMonthInvoice(draft, pricingTiers, monthId, monthName);
    const invoices = ensured.invoices.map(inv => ({ ...inv }));
    const current = invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
    const internalNoCharge = Boolean(current?.notes?.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));
    const lumpSettled = Boolean(current?.notes?.includes('MOLDATK_LUMP_SETTLEMENT'));
    if (current && current.status !== 'paid' && current.status !== 'free' && !internalNoCharge && !lumpSettled) {
      const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));
      current.amperes = amperes;
      current.originalAmperes = currentCalc.originalAmperes;
      current.discountedAmperes = currentCalc.discountedAmperes;
      current.billedAmperes = currentCalc.billedAmperes;
      current.grossAmountBeforeDiscount = currentCalc.grossTotal;
      current.discountAmount = currentCalc.discountAmount;
      current.tier = selectedTierType;
      current.pricePerAmpere = currentCalc.pricePerAmpere;
      current.fixedFee = currentCalc.fixedFee;
      current.totalAmount = currentCalc.total;
      current.paidAmount = Math.min(alreadyPaid, currentCalc.total);
      current.remainingAmount = Math.max(0, currentCalc.total - current.paidAmount);
      current.status = current.remainingAmount === 0 ? 'paid' : current.paidAmount > 0 ? 'partial' : 'unpaid';
    }
    const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const currentPaid = Number(current?.paidAmount || 0);
    const anyPartial = invoices.some(inv => Number(inv.paidAmount || 0) > 0 && getInvoiceRemaining(inv) > 0);
    const updatedSubscriber: Subscriber = {
      ...draft,
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: currentPaid,
      paymentStatus: totalOutstanding === 0
        ? (current?.status === 'free' ? 'free' : 'paid')
        : (currentPaid > 0 || anyPartial ? 'partial' : 'unpaid'),
    };
    onSaveSubscriber(updatedSubscriber);
    if (onAddAuditLog) onAddAuditLog({
      category: 'update',
      title: 'تعديل بيانات',
      details: changesDetails,
      entityId: updatedSubscriber.id,
      entityName: fullName + ' (' + updatedSubscriber.code + ')',
      actorName: 'الإدارة العامة',
    });
    setIsEditing(false);
  };

  const executeUnpaidAction = () => {
    if (!subscriberToEdit) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free'
      ? { ...inv, paidAmount: 0, remainingAmount: Number(inv.totalAmount || 0), status: 'unpaid' as const, paymentDate: undefined }
      : inv);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: 0,
      paymentStatus: totalOutstanding === 0 ? 'paid' : 'unpaid',
    };
    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'cancellation', title: 'إلغاء تسديد الشهر الحالي',
      details: 'إلغاء تسديد الشهر الحالي مع الاحتفاظ بالديون والأشهر السابقة',
      entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة',
    });
    setIsConfirmUnpaidOpen(false);
    onClose();
  };

  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const totalOutstanding = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const onboardingNoCurrentCharge = String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');
    // Zero-charge only blocks a fake cancellation/payment when there is truly no debt.
    // If any invoice still has money due, full payment must continue normally.
    if (onboardingNoCurrentCharge && totalOutstanding <= 0) return;

    // A fully settled subscriber uses the same prominent button to enter the cancel-payment flow.
    if (totalOutstanding <= 0) {
      setIsConfirmUnpaidOpen(true);
      return;
    }

    const now = new Date();
    const allocation = applyPaymentOldestFirst(
      subscriberToEdit,
      pricingTiers,
      totalOutstanding,
      now,
      monthId,
      monthName
    );
    const current = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled') || ensured.currentInvoice;

    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(current.paidAmount || 0),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      lastPaymentDate: now.toISOString(),
    };

    const receipt: SubscriberInvoice = {
      ...current,
      id: 'receipt-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: totalOutstanding,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
    };

    // IMPORTANT: persist the payment first. Receipt opening/printing is only the post-payment step.
    onSaveSubscriber(updated);
    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment',
        title: 'تسديد المشترك',
        details: 'تم تنفيذ التسديد فعلياً وتوزيع المبلغ على الديون الأقدم أولاً ثم الشهر الحالي',
        entityId: updated.id,
        entityName: updated.fullName + ' (' + (updated.code || updated.subscriberCode || '') + ')',
        actorName: 'الإدارة العامة',
        amount: totalOutstanding,
      });
    }

    // Open the receipt only after save has been issued, then trigger automatic print.
    if (onOpenReceiptModal) {
      window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120);
    }
  };

  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
    if (!subscriberToEdit) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const now = new Date();
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);

    if (status === 'free') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled'
        ? { ...inv, totalAmount: 0, paidAmount: 0, remainingAmount: 0, status: 'free' as const, notes: 'إعفاء الشهر الحالي' }
        : inv);
      const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const updated: Subscriber = {
        ...subscriberToEdit,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        amountDue: totalOutstanding,
        amountPaid: 0,
        paymentStatus: totalOutstanding === 0 ? 'free' : 'unpaid',
      };
      onSaveSubscriber(updated);
      if (onAddAuditLog) onAddAuditLog({
        category: 'payment', title: 'إعفاء مجاني للشهر الحالي', details: 'تم إعفاء الشهر الحالي بدون حذف الديون السابقة',
        entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة', amount: 0,
      });
      onClose();
      return;
    }

    const finalPaid = Math.max(0, Number(paidAmount || 0));
    if (finalPaid <= 0) return;
    const allocation = applyPaymentOldestFirst(subscriberToEdit, pricingTiers, finalPaid, now, monthId, monthName);
    const current = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled') || ensured.currentInvoice;
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(current.paidAmount || 0),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      lastPaymentDate: now.toISOString(),
    };
    const receipt: SubscriberInvoice = {
      ...current,
      id: 'receipt-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: finalPaid,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
    };
    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'payment', title: allocation.totalDebtAfter === 0 ? 'تسديد كامل' : 'تسديد جزئي',
      details: 'تم توزيع الدفعة على الديون الأقدم أولاً ثم الشهر الحالي',
      entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة', amount: finalPaid,
    });
    if (onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();
    setIsAdvancedOpen(false);
  };

  const handleLumpSettlement = (paidAmount: number) => {
    if (!subscriberToEdit) return;
    const finalPaid = Math.max(0, Math.round(Number(paidAmount || 0)));
    if (finalPaid <= 0) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const now = new Date();
    try {
      const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
      const currentBefore = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');
      const settlement = applyLumpSettlementAllDebt(subscriberToEdit, pricingTiers, finalPaid, now, monthId, monthName);
      const receiptBase = settlement.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free') || settlement.invoices.find(inv => inv.status === 'paid') || ensured.currentInvoice;
      const updated: Subscriber = { ...subscriberToEdit, invoicesHistory: settlement.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)), amountDue: 0, amountPaid: settlement.receivedAmount, paymentStatus: 'paid', lastPaymentDate: now.toISOString() };
      const receipt: SubscriberInvoice = {
        ...receiptBase,
        id: 'receipt-lump-' + subscriberToEdit.id + '-' + Date.now(),
        receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
        totalAmount: settlement.receivedAmount,
        paidAmount: settlement.receivedAmount,
        remainingAmount: 0,
        status: 'paid',
        previousDebtBefore: Math.max(0, settlement.totalDebtBefore - getInvoiceRemaining(currentBefore || ensured.currentInvoice)),
        currentCharge: Math.max(0, Number(currentBefore?.totalAmount || 0)),
        totalBeforePayment: settlement.totalDebtBefore,
        appliedToPreviousDebt: settlement.allocations.filter(x => x.monthId < monthId).reduce((sum, x) => sum + x.amount, 0),
        appliedToCurrentMonth: settlement.allocations.filter(x => x.monthId === monthId).reduce((sum, x) => sum + x.amount, 0),
        totalOutstandingAfter: 0,
        paymentDate: now.toISOString(),
        notes: 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT_RECEIPT|received=' + settlement.receivedAmount + '|waived=' + settlement.waivedAmount,
      };
      onSaveSubscriber(updated);
      if (onAddAuditLog) onAddAuditLog({ category: 'payment', title: 'تسديد مقطوع — تصفية كاملة', details: 'إجمالي الذمة قبل التسوية ' + settlement.totalDebtBefore.toLocaleString('en-US') + ' | المستلم فعلياً ' + settlement.receivedAmount.toLocaleString('en-US') + ' | فرق التسوية ' + settlement.waivedAmount.toLocaleString('en-US') + ' | الرصيد المتبقي 0', entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || '') + ')', actorName: 'الإدارة العامة', amount: settlement.receivedAmount });
      setIsAdvancedOpen(false);
      if (onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();
    } catch (error) {
      const reason = String((error as any)?.message || error || '');
      setCustomError(reason.includes('INVALID_LUMP_AMOUNT') ? 'المبلغ يجب أن يكون بين 1 وإجمالي ذمة المشترك.' : reason.includes('NO_OUTSTANDING_DEBT') ? 'لا يوجد دين مستحق على المشترك.' : 'تعذر تنفيذ التسديد المقطوع. أعد المحاولة.');
    }
  };

  const formatNum = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null || Number.isNaN(Number(num))) return '0';
    return Number(num).toLocaleString('en-US');
  };

  const outstanding = hasPricing ? Math.max(0, Number(subscriberToEdit?.amountDue || 0)) : 0;
  const visibleInvoices = (subscriberToEdit?.invoicesHistory || []).filter(inv => !String(inv.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));
  const settlementMonthId = activeMonthId || getMonthId();
  const settlementCurrentInvoice = (subscriberToEdit?.invoicesHistory || []).find(inv => inv.monthId === settlementMonthId && inv.status !== 'cancelled' && inv.status !== 'free');
  const settlementCurrentRemaining = settlementCurrentInvoice && !String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')
    ? getInvoiceRemaining(settlementCurrentInvoice)
    : 0;
  const isOnboardingNoCurrentCharge = Boolean(settlementCurrentInvoice && String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));
  const paid = hasPricing ? Math.max(0, Number(subscriberToEdit?.amountPaid || 0)) : 0;
  const billedAmount = subscriberToEdit?.paymentStatus === 'paid' ? paid : outstanding + paid;
  const isPaid = subscriberToEdit?.paymentStatus === 'paid' && outstanding <= 0;
  const isFree = subscriberToEdit?.paymentStatus === 'free' || subscriberToEdit?.tier === 'free';

  const whatsappDigits = subscriberToEdit?.phone?.replace(/\D/g, '') || '';
  const hasWhatsAppPhone = whatsappDigits.length > 0;

  const handleWhatsApp = () => {
    if (!hasWhatsAppPhone) return;
    const intl = whatsappDigits.startsWith('0') ? `964${whatsappDigits.slice(1)}` : whatsappDigits;
    window.open(`https://wa.me/${intl}`, '_blank');
  };

  const handleDelete = () => {
    if (!subscriberToEdit || !onDeleteSubscriber) return;
    onDeleteSubscriber(subscriberToEdit.id);
    setIsConfirmDeleteOpen(false);
    onClose();
  };

  const DetailRow = ({ label, value, strong = false }: { label: string; value?: React.ReactNode; strong?: boolean }) => (
    <div className="grid grid-cols-[1fr_1.25fr] items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-left text-xs sm:text-sm text-slate-900 dark:text-white ${strong ? 'font-black' : 'font-bold'}`}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-[#081225] sm:bg-slate-950/70 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4 font-['Cairo']" dir="rtl">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl bg-slate-50 dark:bg-[#081225] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800 overflow-y-auto">
        {activeView === 'profile' && !isEditing && subscriberToEdit ? (
          <div className="min-h-full p-4 sm:p-5 pb-8">
            <div className="grid grid-cols-3 items-center mb-4">
              <button type="button" onClick={onClose} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">رجوع</button>
              <h2 className="text-center text-base font-black text-slate-950 dark:text-white">ملف المشترك</h2>
              <button type="button" onClick={() => setIsEditing(true)} className="justify-self-end px-3 py-2 rounded-xl bg-[#071a34] text-white text-xs font-black flex items-center gap-1.5 shadow-sm"><Edit3 className="w-3.5 h-3.5" />تعديل</button>
            </div>

            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm mb-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-3xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 flex items-center justify-center"><UserRound className="w-8 h-8" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-black text-slate-950 dark:text-white truncate">{subscriberToEdit.fullName}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5" dir="ltr">{subscriberToEdit.code || subscriberToEdit.subscriberCode}</div>
                  <span className={`inline-flex mt-2 px-3 py-1 rounded-full border text-[10px] font-black ${paymentStatusClass(subscriberToEdit.paymentStatus)}`}>{paymentStatusLabel(subscriberToEdit.paymentStatus)}</span>
                </div>
              </div>
            </div>

            {/* WHATSAPP_PRIMARY_ACTION_V1 */}
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={!hasWhatsAppPhone}
              aria-disabled={!hasWhatsAppPhone}
              className={`w-full min-h-[64px] py-4 px-5 rounded-2xl text-sm font-black flex items-center justify-center gap-3 mb-3 border transition-all active:scale-[0.985] ${hasWhatsAppPhone
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'bg-slate-100 dark:bg-[#101a33] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-70'}`}
            >
              <MessageCircle className="w-6 h-6 shrink-0" />
              <span>واتساب</span>
            </button>

            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <DetailRow label="رقم الهاتف" value={subscriberToEdit.phone ? <span dir="ltr">{subscriberToEdit.phone}</span> : '—'} />
              <DetailRow label="الكابينة" value={subscriberToEdit.lineName || subscriberToEdit.line || '—'} strong />
              <DetailRow label="عدد الأمبيرات" value={`${formatNum(subscriberToEdit.amperes)} أمبير`} strong />
              <DetailRow label="المبلغ المستحق" value={formatCurrency(billedAmount)} strong />
              <DetailRow label="المبلغ المدفوع" value={formatCurrency(paid)} strong />
              <DetailRow label="المتبقي" value={formatCurrency(outstanding)} strong />
              <DetailRow label="العنوان" value={subscriberToEdit.address || '—'} />
              <DetailRow label="رقم الصندوق" value={subscriberToEdit.boxNumber || '—'} />
              <DetailRow label="ملاحظات" value={subscriberToEdit.notes || '—'} />
            </div>


            {/* PAYMENT_BUTTON_BELOW_DETAILS_V1 */}
            {!hasPricing && <div className="mb-3 rounded-xl bg-slate-100 p-3 text-center text-sm font-bold text-slate-700">لا يوجد مبلغ مطلوب — لا توجد تسعيرة</div>}
            {hasPricing && !isPaid && !isFree && (
              <button
                type="button"
                onClick={handleQuickPayment}
                className="w-full min-h-[72px] py-4 px-5 rounded-2xl text-white font-black shadow-xl transition-all active:scale-[0.985] flex items-center justify-center gap-3 mb-3 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-7 h-7 shrink-0" />
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-base">تسديد المشترك</span>
                  <span className="text-xs mt-1 opacity-95">تسديد الآن: {formatCurrency(outstanding || currentCalc.total)}</span>
                </span>
              </button>
            )}

            {/* LOWER_PAYMENT_ACTIONS_V1 */}
            <div className="mt-3 space-y-2">
              {hasPricing && isPaid && !isFree && !isOnboardingNoCurrentCharge && (
                <button
                  type="button"
                  onClick={handleQuickPayment}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.985] transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />إلغاء التسديد
                </button>
              )}

              {hasPricing && !isPaid && !isFree && (
                <button
                  type="button"
                  onClick={() => { setCustomAmount(String(outstanding || currentCalc.total)); setCustomError(''); setIsAdvancedOpen(true); }}
                  className="w-full py-3.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-sm font-black text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2"
                >
                  <Sliders className="w-5 h-5" />تسديد مخصص / جزئي
                </button>
              )}

              {/* PREVIOUS_INVOICES_BELOW_PAYMENT_V1 */}
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className="w-full py-3.5 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-sm font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2"
              >
                <History className="w-5 h-5 text-blue-500" />الفواتير السابقة ({subscriberToEdit.invoicesHistory?.length || 0})
              </button>
            </div>
          </div>
        ) : activeView === 'history' && subscriberToEdit ? (
          <div className="min-h-full p-4 sm:p-5 pb-8">
            <div className="grid grid-cols-3 items-center mb-4">
              <button type="button" onClick={() => setActiveView('profile')} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">رجوع</button>
              <h2 className="text-center text-sm font-black text-slate-950 dark:text-white">سجل الفواتير</h2>
              <button type="button" onClick={onClose} className="justify-self-end w-9 h-9 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {!visibleInvoices.length ? (
              <div className="py-14 text-center bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl"><History className="w-10 h-10 mx-auto text-slate-300 mb-2" /><p className="text-xs font-bold text-slate-500">لا توجد فواتير مسجلة لهذا المشترك.</p></div>
            ) : (
              <div className="space-y-2.5">
                {visibleInvoices.map(inv => (
                  <div key={inv.id} className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="font-black text-xs text-slate-950 dark:text-white truncate">{inv.monthNameAr}</div><div className="text-[10px] text-slate-400 mt-1">{inv.receiptNumber || inv.issueDate}</div><div className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-1">{formatCurrency(inv.paidAmount || 0)}</div></div>
                    <button type="button" onClick={() => onOpenReceiptModal?.(subscriberToEdit, inv, false)} className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-black flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />فتح الوصل</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="min-h-full p-4 sm:p-5 pb-8 space-y-4">
            <div className="grid grid-cols-3 items-center mb-2">
              <button type="button" onClick={() => subscriberToEdit ? setIsEditing(false) : onClose()} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">إلغاء</button>
              <h2 className="text-center text-sm font-black text-slate-950 dark:text-white">{subscriberToEdit ? 'تعديل المشترك' : 'إضافة مشترك'}</h2><div />
            </div>
            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-4">
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المشترك الثلاثي *</label><input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الكود</label><input value={code} onChange={e => setCode(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none" dir="ltr" /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الهاتف</label><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none" dir="ltr" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">عدد الأمبيرات</label><input type="number" min="1" required disabled={isReadOnlyAmperes} value={amperes} onChange={e => setAmperes(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none disabled:opacity-60" dir="ltr" /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">فئة الاشتراك</label><select value={tier} onChange={e => setTier(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">{!hasPricing && <option value={tier}>{({ normal: "اعتيادي", commercial: "تجاري", golden: "ذهبي", free: "مجاني" } as Record<string, string>)[tier] || tier}</option>}{pricingTiers.map(t => <option key={t.id} value={t.id}>{t.nameAr}</option>)}</select></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" />الكابينة</label><select value={line} onChange={e => setLine(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">{lines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
            </div>
            {currentTierObj?.type !== 'free' && (
              <div data-ampere-discount-editor-v1 className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-xs font-black text-slate-900 dark:text-white">خصم الأمبيرات الشهري</h3><p className="text-[10px] text-slate-500 mt-1">يبقى فعالاً تلقائياً مع كل تسعيرة شهرية جديدة إلى أن تعدله أو تصفره.</p></div>
                  <span className="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">{currentCalc.billedAmperes}A محتسب</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">الأمبيرات المخصومة</label><input type="number" min="0" max={Math.max(0, Number(amperes) || 0)} step="0.5" value={ampereDiscount} onChange={e => setAmpereDiscount(Math.min(Math.max(0, Number(amperes) || 0), Math.max(0, Number(e.target.value) || 0)))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500" dir="ltr" /></div>
                  <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">سبب الخصم (اختياري)</label><input value={ampereDiscountReason} onChange={e => setAmpereDiscountReason(e.target.value)} placeholder="مثال: اتفاق خاص" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500" /></div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
                  <div><span className="block text-[9px] font-bold text-slate-400">الأصلي</span><strong className="text-xs text-slate-900 dark:text-white">{currentCalc.originalAmperes}A</strong></div>
                  <div><span className="block text-[9px] font-bold text-slate-400">الخصم</span><strong className="text-xs text-amber-600">{currentCalc.discountedAmperes}A</strong></div>
                  <div><span className="block text-[9px] font-bold text-slate-400">قيمة الخصم</span><strong className="text-xs text-emerald-600">{formatCurrency(currentCalc.discountAmount)}</strong></div>
                </div>
              </div>
            )}
            {!subscriberToEdit && currentTierObj?.type !== 'free' && (
              <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">
                <div><h3 className="text-xs font-black text-slate-900 dark:text-white">حالة المديونية عند التسجيل</h3><p className="text-[10px] text-slate-500 mt-1">حدد هل يبدأ المشترك بدين سابق أم يبدأ بدون أي استحقاق لهذا الشهر.</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setNewDebtMode('none'); setPriorDebtMonthId(''); setNewDebtError(''); }} className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all ${newDebtMode === 'none' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>بدون دين سابق</button>
                  <button type="button" onClick={() => { setNewDebtMode('prior'); setNewDebtError(''); }} className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all ${newDebtMode === 'prior' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>عليه دين سابق</button>
                </div>
                {newDebtMode === 'none' && <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">سيتم إضافة المشترك الآن بدين 0 د.ع، وتبدأ جبايته من دورة الشهر القادمة.</div>}
                {newDebtMode === 'prior' && (
                  <div className="space-y-2">
                    {availableDebtTariffs.length === 0 ? (
                      <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 text-[11px] font-black text-rose-600 dark:text-rose-300">لا توجد تسعيرة شهرية محفوظة. يجب إضافة تسعيرة الشهر أولاً، ولا يمكن تسجيل دين بدون تسعيرة.</div>
                    ) : (<>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">اختر الشهر الذي يعود له الدين</label>
                      <select value={priorDebtMonthId} onChange={e => { setPriorDebtMonthId(e.target.value); setNewDebtError(''); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">
                        <option value="">اختر تسعيرة الشهر</option>
                        {availableDebtTariffs.map(m => <option key={m.id} value={m.id}>{m.monthNameAr}</option>)}
                      </select>
                      {selectedPriorTariff && <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">الدين حسب {selectedPriorTariff.monthNameAr}</span><strong className="text-sm text-amber-700 dark:text-amber-300">{formatCurrency(selectedPriorDebtAmount)}</strong></div>}
                    </>)}
                  </div>
                )}
                {newDebtError && <p className="text-[11px] font-black text-rose-500">{newDebtError}</p>}
              </div>
            )}
            <button type="submit" disabled={!subscriberToEdit && currentTierObj?.type !== 'free' && (!newDebtMode || (newDebtMode === 'prior' && !priorDebtMonthId))} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-black shadow-md">{subscriberToEdit ? 'حفظ التعديلات' : 'إضافة المشترك'}</button>
            {/* MOLDATK_EDIT_DELETE_ONLY_V1 */}
            {subscriberToEdit && onDeleteSubscriber && (
              <button type="button" onClick={() => setIsConfirmDeleteOpen(true)} className="w-full py-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/5 text-rose-600 text-xs font-black flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف المشترك</button>
            )}
          </form>
        )}

        {isAdvancedOpen && subscriberToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" dir="rtl">
            <div className="w-full max-w-md bg-white dark:bg-[#101a33] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-black text-slate-950 dark:text-white">التسديد المخصص</h3><p className="text-[10px] text-slate-400 mt-1">إجمالي المتبقي حالياً: {formatCurrency(outstanding)}</p></div><button type="button" onClick={() => setIsAdvancedOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button></div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button type="button" onClick={() => { setCustomPaymentMode('partial'); setCustomAmount(String(outstanding)); setCustomError(''); }} className={`py-3 rounded-2xl border text-xs font-black ${customPaymentMode === 'partial' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>تسديد جزئي</button>
                <button type="button" onClick={() => { setCustomPaymentMode('lump'); setCustomAmount(String(settlementCurrentRemaining || '')); setCustomError(''); }} className={`py-3 rounded-2xl border text-xs font-black ${customPaymentMode === 'lump' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>تسديد مقطوع</button>
              </div>

              {customPaymentMode === 'lump' && <div className="mb-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-[10px] leading-5 font-bold text-amber-800 dark:text-amber-300">يغلق كامل ذمة المشترك بجميع الأشهر بالمبلغ الذي تحدده. فرق التسوية لا يبقى ديناً، والقاصة تحتسب المبلغ المستلم فعلياً فقط، ويصبح الرصيد المتبقي 0.</div>}
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{customPaymentMode === 'lump' ? 'المبلغ المتفق على استلامه' : 'مبلغ الدفعة'}</label>
              <input type="number" min="1" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setCustomError(''); }} className="mt-1.5 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-slate-950 dark:text-white outline-none focus:border-blue-500" dir="ltr" />
              {customPaymentMode === 'lump' && <p className="mt-1.5 text-[10px] font-bold text-slate-500">إجمالي الذمة قبل التسوية: {formatCurrency(outstanding)}</p>}
              {customError && <p className="text-[11px] font-bold text-rose-500 mt-2">{customError}</p>}
              <button type="button" onClick={() => {
                const amount = Number(customAmount);
                const maxAmount = outstanding;
                if (!Number.isFinite(amount) || amount <= 0 || amount > maxAmount) { setCustomError('أدخل مبلغاً بين 1 و ' + formatNum(maxAmount) + ' د.ع'); return; }
                if (customPaymentMode === 'lump') handleLumpSettlement(amount); else handleCustomPayment('partial', amount);
              }} className="mt-4 w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black">{customPaymentMode === 'lump' ? 'اعتماد التسديد المقطوع وإغلاق الشهر' : 'تسديد المبلغ وإصدار الوصل'}</button>
              <button type="button" onClick={() => handleCustomPayment('free', 0)} className="mt-2 w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-slate-700">إعفاء الشهر الحالي</button>
            </div>
          </div>
        )}

        {hasPricing && isConfirmUnpaidOpen && subscriberToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-sm bg-white dark:bg-[#101a33] rounded-3xl p-5 text-center border border-rose-200 dark:border-rose-900/50 shadow-2xl"><AlertTriangle className="w-9 h-9 text-rose-500 mx-auto" /><h3 className="mt-3 text-sm font-black text-slate-950 dark:text-white">إلغاء تسديد الشهر الحالي؟</h3><p className="mt-1 text-[11px] text-slate-500">تبقى الديون والفواتير السابقة محفوظة.</p><div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={() => setIsConfirmUnpaidOpen(false)} className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">تراجع</button><button type="button" onClick={executeUnpaidAction} className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black">تأكيد الإلغاء</button></div></div></div>
        )}

        {isConfirmDeleteOpen && subscriberToEdit && onDeleteSubscriber && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-sm bg-white dark:bg-[#101a33] rounded-3xl p-5 text-center border border-rose-200 dark:border-rose-900/50 shadow-2xl"><Trash2 className="w-9 h-9 text-rose-500 mx-auto" /><h3 className="mt-3 text-sm font-black text-slate-950 dark:text-white">حذف المشترك نهائياً؟</h3><p className="mt-1 text-[11px] text-slate-500">لا يمكن التراجع عن عملية الحذف.</p><div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={() => setIsConfirmDeleteOpen(false)} className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">تراجع</button><button type="button" onClick={handleDelete} className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black">حذف</button></div></div></div>
        )}
      </div>
    </div>
  );
};

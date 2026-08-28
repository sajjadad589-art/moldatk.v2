import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  Edit3,
  DollarSign,
  Sliders,
  CheckCircle2,
  X,
  Layers,
  ChevronDown,
  Printer,
  History,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, LineDistribution, AuditLogEntry, SubscriberInvoice } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberToEdit: Subscriber | null;
  pricingTiers: SubscriptionTierPricing[];
  lines: LineDistribution[];
  onSaveSubscriber: (subscriber: Subscriber) => void;
  onDeleteSubscriber: (subId: string) => void;
  onTogglePaymentStatus: (subId: string) => void;
  onOpenReceiptModal?: (sub: Subscriber, invoice?: SubscriberInvoice) => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
}

export const SubscriberModal: React.FC<SubscriberModalProps> = ({
  isOpen,
  onClose,
  subscriberToEdit,
  pricingTiers,
  lines,
  onSaveSubscriber,
  onDeleteSubscriber,
  onOpenReceiptModal,
  onAddAuditLog,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [amperes, setAmperes] = useState<number>(5);
  const [tier, setTier] = useState<string>('standard');
  const [line, setLine] = useState<string>('');
  
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmUnpaidOpen, setIsConfirmUnpaidOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');

  useEffect(() => {
    if (subscriberToEdit) {
      setFullName(subscriberToEdit.fullName || '');
      setCode(subscriberToEdit.code || '');
      setPhone(subscriberToEdit.phone || '');
      setAmperes(subscriberToEdit.amperes || 5);
      setTier(subscriberToEdit.tier || pricingTiers[0]?.id || 'standard');
      setLine(subscriberToEdit.lineName || lines[0]?.name || '');
      setCustomAmount(subscriberToEdit.amountDue?.toString() || '0');
      setIsEditing(false);
    } else {
      setFullName('');
      setCode(`MW-${Math.floor(1000 + Math.random() * 9000)}`);
      setPhone('');
      setAmperes(5);
      setTier(pricingTiers[0]?.id || 'standard');
      setLine(lines[0]?.name || '');
      setCustomAmount('0');
      setIsEditing(true);
    }
    setActiveTab('details');
    setIsConfirmDeleteOpen(false);
    setIsConfirmUnpaidOpen(false);
    setIsAdvancedOpen(false);
  }, [subscriberToEdit, isOpen, pricingTiers, lines]);

  if (!isOpen) return null;

  const currentTierObj = pricingTiers.find(p => p.id === tier || p.type === tier) || pricingTiers[0];
  const pricePerAmp = currentTierObj ? currentTierObj.pricePerAmpere : 0;
  const calculatedTotal = amperes * pricePerAmp;

  const currentCalc = {
    total: calculatedTotal,
    pricePerAmpere: pricePerAmp,
    fixedFee: 0
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    let changesDetails = `تعديل بيانات المشترك "${fullName}" (${code})`;
    
    if (subscriberToEdit) {
      const oldAmperes = subscriberToEdit.amperes;
      const oldTier = subscriberToEdit.tier;
      const oldLine = subscriberToEdit.lineName;
      const oldPhone = subscriberToEdit.phone;

      const changes = [];
      if (oldAmperes !== amperes) changes.push(`الأمبيرات: من (${oldAmperes}) إلى (${amperes})`);
      if (oldTier !== tier) {
        const oldTierName = pricingTiers.find(t => t.id === oldTier || t.type === oldTier)?.nameAr || oldTier;
        const newTierName = pricingTiers.find(t => t.id === tier || t.type === tier)?.nameAr || tier;
        changes.push(`الفئة: من (${oldTierName}) إلى (${newTierName})`);
      }
      if (oldLine !== line) changes.push(`الكابينة: من (${oldLine || 'غير محدد'}) إلى (${line})`);
      if (oldPhone !== phone) changes.push(`الهاتف تم تغييره`);

      if (changes.length > 0) {
        changesDetails = `تم التعديل: ${changes.join(' | ')}`;
      } else {
        changesDetails = `حفظ التعديلات للمشترك "${fullName}"`;
      }
    }

    const updatedSubscriber: Subscriber = {
      id: subscriberToEdit ? subscriberToEdit.id : `sub-${Date.now()}`,
      code: code || `MW-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName,
      phone,
      amperes,
      tier: tier as any,
      lineName: line || lines[0]?.name || 'الخط الرئيسي',
      notes: subscriberToEdit?.notes || '',
      paymentStatus: subscriberToEdit ? subscriberToEdit.paymentStatus : 'unpaid',
      amountDue: currentCalc.total,
      amountPaid: subscriberToEdit ? (subscriberToEdit.paymentStatus === 'paid' ? currentCalc.total : (subscriberToEdit.amountPaid || 0)) : 0,
      invoicesHistory: subscriberToEdit ? subscriberToEdit.invoicesHistory : [],
    };

    onSaveSubscriber(updatedSubscriber);
    
    if (subscriberToEdit && onAddAuditLog) {
      onAddAuditLog({
        category: 'update',
        title: 'تعديل بيانات',
        details: changesDetails,
        entityId: updatedSubscriber.id,
        entityName: `${fullName} (${updatedSubscriber.code})`,
        actorName: 'الإدارة العامة',
      });
    }

    setIsEditing(false);
    if (!subscriberToEdit) onClose();
  };

  const executeUnpaidAction = () => {
    if (!subscriberToEdit) return;

    const updated: Subscriber = {
      ...subscriberToEdit,
      amountDue: currentCalc.total,
      paymentStatus: 'unpaid',
      amountPaid: 0,
    };

    onSaveSubscriber(updated);

    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'cancellation',
        title: 'إلغاء تسديد',
        details: `إلغاء تسديد فاتورة للمشترك "${subscriberToEdit.fullName}" (${subscriberToEdit.code})`,
        entityId: subscriberToEdit.id,
        entityName: `${subscriberToEdit.fullName} (${subscriberToEdit.code})`,
        actorName: 'الإدارة العامة',
      });
    }

    setIsConfirmUnpaidOpen(false);
    onClose();
  };

  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;

    const isCurrentlyPaid = subscriberToEdit.paymentStatus === 'paid';
    
    if (isCurrentlyPaid) {
      setIsConfirmUnpaidOpen(true);
      return;
    }

    const newInvoice: SubscriberInvoice = {
      id: `inv-${Date.now()}`,
      subscriberId: subscriberToEdit.id,
      receiptNumber: `REC-${subscriberToEdit.code}-${Date.now().toString().slice(-4)}`,
      monthId: '2026-08',
      monthNameAr: 'شهر 8 (آب 2026)',
      totalAmount: currentCalc.total,
      paidAmount: currentCalc.total,
      remainingAmount: 0,
      status: 'paid',
      issueDate: new Date().toISOString().split('T')[0],
      amperes: subscriberToEdit.amperes,
      pricePerAmpere: currentCalc.pricePerAmpere,
      fixedFee: currentCalc.fixedFee,
      tier: subscriberToEdit.tier,
    };

    const updated: Subscriber = {
      ...subscriberToEdit,
      amountDue: currentCalc.total,
      paymentStatus: 'paid',
      amountPaid: currentCalc.total,
      invoicesHistory: [newInvoice, ...(subscriberToEdit.invoicesHistory || [])],
    };

    onSaveSubscriber(updated);

    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment',
        title: 'تسديد',
        details: `تسديد اشتراك كامل للمشترك "${subscriberToEdit.fullName}" (${subscriberToEdit.code})`,
        entityId: subscriberToEdit.id,
        entityName: `${subscriberToEdit.fullName} (${subscriberToEdit.code})`,
        actorName: 'الإدارة العامة',
        amount: currentCalc.total,
      });
    }

    if (onOpenReceiptModal) {
      onOpenReceiptModal(updated, newInvoice);
    } else {
      onClose();
    }
  };

  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
    if (!subscriberToEdit) return;
    
    const finalPaid = status === 'free' ? 0 : paidAmount;
    const remaining = Math.max(0, currentCalc.total - finalPaid);

    const newInvoice: SubscriberInvoice = {
      id: `inv-${Date.now()}`,
      subscriberId: subscriberToEdit.id,
      receiptNumber: `REC-${subscriberToEdit.code}-${Date.now().toString().slice(-4)}`,
      monthId: '2026-08',
      monthNameAr: 'شهر 8 (آب 2026)',
      totalAmount: currentCalc.total,
      paidAmount: finalPaid,
      remainingAmount: remaining,
      status: status,
      issueDate: new Date().toISOString().split('T')[0],
      amperes: subscriberToEdit.amperes,
      pricePerAmpere: currentCalc.pricePerAmpere,
      fixedFee: currentCalc.fixedFee,
      tier: subscriberToEdit.tier,
    };

    const updated: Subscriber = {
      ...subscriberToEdit,
      amountDue: currentCalc.total,
      paymentStatus: status,
      amountPaid: finalPaid,
      invoicesHistory: [newInvoice, ...(subscriberToEdit.invoicesHistory || [])],
    };

    onSaveSubscriber(updated);

    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment',
        title: status === 'partial' ? 'تسديد جزئي' : 'إعفاء مجاني',
        details: `تسجيل دفعة للمشترك "${subscriberToEdit.fullName}" (${subscriberToEdit.code}) بمبلغ ${finalPaid}`,
        entityId: subscriberToEdit.id,
        entityName: `${subscriberToEdit.fullName} (${subscriberToEdit.code})`,
        actorName: 'الإدارة العامة',
        amount: finalPaid,
      });
    }

    if (onOpenReceiptModal) {
      onOpenReceiptModal(updated, newInvoice);
    } else {
      onClose();
    }
  };

  const formatNum = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US');
  };

  const isPaid = subscriberToEdit?.paymentStatus === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
      <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-xl space-y-6 max-h-[90vh] overflow-y-auto">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            {subscriberToEdit && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'details' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  بيانات المشترك
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>سجل الدفعات والفواتير ({subscriberToEdit.invoicesHistory?.length || 0})</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center shadow-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {subscriberToEdit ? `ملف المشترك: ${subscriberToEdit.fullName}` : 'إضافة مشترك جديد'}
              </h3>
              {subscriberToEdit && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/15 text-blue-400 text-xs font-black cursor-pointer hover:bg-blue-600/25 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل البيانات</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المشترك الثلاثي *</label>
                <input
                  type="text"
                  required
                  disabled={!isEditing}
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-70 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الكود</label>
                <input
                  type="text"
                  required
                  disabled={!isEditing}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white font-mono disabled:opacity-70 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الهاتف</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white font-mono disabled:opacity-70 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">عدد الأمبيرات (A)</label>
                <input
                  type="number"
                  min="1"
                  required
                  disabled={!isEditing}
                  value={amperes}
                  onChange={e => setAmperes(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white font-mono disabled:opacity-70 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">فئة الاشتراك</label>
                <select
                  disabled={!isEditing}
                  value={tier}
                  onChange={e => setTier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white disabled:opacity-70 focus:outline-none cursor-pointer"
                >
                  {pricingTiers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr} ({t.pricePerAmpere} د.ع)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <span>كابينة المشترك</span>
                </label>
                <select
                  disabled={!isEditing}
                  value={line}
                  onChange={e => setLine(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white disabled:opacity-70 focus:outline-none cursor-pointer"
                >
                  {lines.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {subscriberToEdit && !isEditing && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">مبلغ الفاتورة المستحق للشهر الحالي:</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5 block" dir="ltr">
                      {formatNum(currentCalc.total)} د.ع
                    </span>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-500 opacity-80" />
                </div>

                <button
                  type="button"
                  onClick={handleQuickPayment}
                  className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isPaid ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isPaid ? 'إلغاء التسديد (جعلها غير مسددة)' : `${formatNum(currentCalc.total)} د.ع تسديد الفاتورة نقداً وطباعة الوصل`}</span>
                </button>

                {!isPaid && (
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                  >
                    <Sliders className="w-4 h-4 text-blue-500" />
                    <span>خيارات متقدمة (تسديد جزئي / إعفاء مجاني)</span>
                  </button>
                )}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف المشترك</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">سجل الدفعات والفواتير المؤرشفة</h4>
              <span className="text-[11px] text-slate-400">إجمالي الفواتير: {subscriberToEdit?.invoicesHistory?.length || 0}</span>
            </div>

            {(!subscriberToEdit?.invoicesHistory || subscriberToEdit.invoicesHistory.length === 0) ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <History className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-500">لا توجد دفعات أو فواتير مسجلة في الأرشيف لهذا المشترك حتى الآن.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
                {subscriberToEdit.invoicesHistory.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{inv.monthNameAr}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                          inv.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {inv.status === 'paid' ? 'مُسدد' : inv.status === 'partial' ? 'مُسدد جزئياً' : 'مجاني'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                        <span>رقم الوصل: {inv.receiptNumber}</span>
                        <span>المبلغ: {formatCurrency(inv.totalAmount)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenReceiptModal && subscriberToEdit) {
                          onOpenReceiptModal(subscriberToEdit, inv);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>إعادة طباعة</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isConfirmUnpaidOpen && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 rounded-3xl">
            <div className="bg-white dark:bg-[#131E38] border border-rose-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">تأكيد إلغاء التسديد</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">هل أنت متأكد من تحويل حالة المشترك إلى غير مسدد؟</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsConfirmUnpaidOpen(false)} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">تراجع</button>
                <button type="button" onClick={executeUnpaidAction} className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer">تأكيد</button>
              </div>
            </div>
          </div>
        )}

        {isAdvancedOpen && subscriberToEdit && !isPaid && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4 rounded-3xl">
            <div className="bg-white dark:bg-[#131E38] border border-blue-500/30 rounded-3xl p-6 w-full max-w-md space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">خيارات التسديد المتقدمة</h4>
                <button onClick={() => setIsAdvancedOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">أدخل مبلغ التسديد الجزئي:</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="المبلغ..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-2xl px-4 py-3 text-base font-black text-slate-900 dark:text-white font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => handleCustomPayment('partial', Number(customAmount))}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-md"
                >
                  تأكيد التسديد الجزئي وطباعة الوصل
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
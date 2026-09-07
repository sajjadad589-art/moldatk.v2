import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  History,
  Layers,
  MessageCircle,
  Phone,
  Printer,
  Sliders,
  Trash2,
  UserRound,
  X,
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
  onDeleteSubscriber?: (subId: string) => void;
  onTogglePaymentStatus?: (subId: string) => void;
  onOpenReceiptModal?: (sub: Subscriber, invoice?: SubscriberInvoice) => void;
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
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmUnpaidOpen, setIsConfirmUnpaidOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (subscriberToEdit) {
      setFullName(subscriberToEdit.fullName || '');
      setCode(subscriberToEdit.code || subscriberToEdit.subscriberCode || '');
      setPhone(subscriberToEdit.phone || '');
      setAmperes(subscriberToEdit.amperes || 5);
      setTier(subscriberToEdit.tier || pricingTiers[0]?.id || 'normal');
      setLine(subscriberToEdit.lineName || subscriberToEdit.line || lines[0]?.name || '');
      setIsEditing(false);
      setActiveView('profile');
    } else {
      setFullName('');
      setCode(`MW-${Math.floor(1000 + Math.random() * 9000)}`);
      setPhone('');
      setAmperes(5);
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
  }, [subscriberToEdit, isOpen, pricingTiers, lines]);

  const currentTierObj = useMemo(
    () => pricingTiers.find(p => p.id === tier || p.type === tier) || pricingTiers[0],
    [pricingTiers, tier]
  );

  const currentCalc = useMemo(() => {
    const pricePerAmpere = currentTierObj?.pricePerAmpere || 0;
    const fixedFee = currentTierObj?.fixedFee || 0;
    return {
      pricePerAmpere,
      fixedFee,
      total: Math.max(0, (Number(amperes) || 0) * pricePerAmpere + fixedFee),
    };
  }, [amperes, currentTierObj]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    const selectedLine = lines.find(l => l.name === line);
    const updated: Subscriber = subscriberToEdit
      ? {
          ...subscriberToEdit,
          code,
          subscriberCode: code,
          fullName: fullName.trim(),
          phone: phone.trim(),
          amperes,
          tier: tier as Subscriber['tier'],
          lineId: selectedLine?.id || subscriberToEdit.lineId,
          lineName: line,
          line,
        }
      : {
          id: `sub-${Date.now()}`,
          code,
          subscriberCode: code,
          fullName: fullName.trim(),
          phone: phone.trim(),
          amperes,
          tier: tier as Subscriber['tier'],
          lineId: selectedLine?.id,
          lineName: line || lines[0]?.name || 'الخط الرئيسي',
          line: line || lines[0]?.name || 'الخط الرئيسي',
          paymentStatus: 'unpaid',
          amountDue: currentCalc.total,
          amountPaid: 0,
          invoicesHistory: [],
        };
    onSaveSubscriber(updated);
    setIsEditing(false);
    if (!subscriberToEdit) onClose();
  };

  const executeUnpaidAction = () => {
    if (!subscriberToEdit) return;
    const updated: Subscriber = { ...subscriberToEdit, paymentStatus: 'unpaid', amountPaid: 0 };
    onSaveSubscriber(updated);
    setIsConfirmUnpaidOpen(false);
  };

  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;
    if (subscriberToEdit.paymentStatus === 'paid') {
      setIsConfirmUnpaidOpen(true);
      return;
    }
    const now = new Date();
    const total = Math.max(0, Number(subscriberToEdit.amountDue || currentCalc.total));
    const invoice: SubscriberInvoice = {
      id: `inv-${Date.now()}`,
      subscriberId: subscriberToEdit.id,
      receiptNumber: `REC-${subscriberToEdit.code}-${Date.now().toString().slice(-5)}`,
      monthId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthNameAr: `شهر ${now.getMonth() + 1}`,
      issueDate: now.toISOString().split('T')[0],
      paymentDate: now.toISOString(),
      amperes: subscriberToEdit.amperes,
      tier: subscriberToEdit.tier,
      pricePerAmpere: currentCalc.pricePerAmpere,
      fixedFee: currentCalc.fixedFee,
      totalAmount: total,
      paidAmount: total,
      remainingAmount: 0,
      status: 'paid',
    };
    const updated: Subscriber = {
      ...subscriberToEdit,
      paymentStatus: 'paid',
      amountPaid: total,
      invoicesHistory: [invoice, ...(subscriberToEdit.invoicesHistory || [])],
      lastPaymentDate: now.toISOString(),
    };
    onSaveSubscriber(updated);
    if (onOpenReceiptModal) onOpenReceiptModal(updated, invoice);
  };

  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
    if (!subscriberToEdit) return;
    const amount = Math.max(0, Number(paidAmount || 0));
    if (status !== 'free' && amount <= 0) return;
    const total = Math.max(0, Number(subscriberToEdit.amountDue || currentCalc.total));
    const remaining = status === 'free' ? 0 : Math.max(0, total - amount);
    const finalStatus: Subscriber['paymentStatus'] = status === 'free' ? 'free' : remaining === 0 ? 'paid' : 'partial';
    const now = new Date();
    const invoice: SubscriberInvoice = {
      id: `inv-${Date.now()}`,
      subscriberId: subscriberToEdit.id,
      receiptNumber: `REC-${subscriberToEdit.code}-${Date.now().toString().slice(-5)}`,
      monthId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthNameAr: `شهر ${now.getMonth() + 1}`,
      issueDate: now.toISOString().split('T')[0],
      paymentDate: now.toISOString(),
      amperes: subscriberToEdit.amperes,
      tier: subscriberToEdit.tier,
      pricePerAmpere: currentCalc.pricePerAmpere,
      fixedFee: currentCalc.fixedFee,
      totalAmount: total,
      paidAmount: status === 'free' ? 0 : amount,
      remainingAmount: remaining,
      status: finalStatus,
    };
    const updated: Subscriber = {
      ...subscriberToEdit,
      paymentStatus: finalStatus,
      amountPaid: status === 'free' ? 0 : amount,
      invoicesHistory: [invoice, ...(subscriberToEdit.invoicesHistory || [])],
    };
    onSaveSubscriber(updated);
    if (status !== 'free' && onOpenReceiptModal) onOpenReceiptModal(updated, invoice);
    setIsAdvancedOpen(false);
  };

  const formatNum = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null || Number.isNaN(Number(num))) return '0';
    return Number(num).toLocaleString('en-US');
  };

  const outstanding = Math.max(0, Number(subscriberToEdit?.amountDue || 0));
  const paid = Math.max(0, Number(subscriberToEdit?.amountPaid || 0));
  const billedAmount = subscriberToEdit?.paymentStatus === 'paid' ? paid : outstanding + paid;
  const isPaid = subscriberToEdit?.paymentStatus === 'paid' && outstanding <= 0;
  const isFree = subscriberToEdit?.paymentStatus === 'free' || subscriberToEdit?.tier === 'free';

  const handleWhatsApp = () => {
    if (!subscriberToEdit?.phone) return;
    const digits = subscriberToEdit.phone.replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `964${digits.slice(1)}` : digits;
    window.open(`https://wa.me/${intl}`, '_blank');
  };

  const handleCall = () => {
    if (subscriberToEdit?.phone) window.location.href = `tel:${subscriberToEdit.phone}`;
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

            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-3xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 flex items-center justify-center"><UserRound className="w-8 h-8" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-black text-slate-950 dark:text-white truncate">{subscriberToEdit.fullName}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5" dir="ltr">{subscriberToEdit.code || subscriberToEdit.subscriberCode}</div>
                  <span className={`inline-flex mt-2 px-3 py-1 rounded-full border text-[10px] font-black ${paymentStatusClass(subscriberToEdit.paymentStatus)}`}>{paymentStatusLabel(subscriberToEdit.paymentStatus)}</span>
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-3 gap-2 mt-4">
              <button type="button" onClick={handleWhatsApp} disabled={!subscriberToEdit.phone} className="py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5 disabled:opacity-40"><MessageCircle className="w-4 h-4 text-emerald-500" />واتساب</button>
              <button type="button" onClick={handleCall} disabled={!subscriberToEdit.phone} className="py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5 disabled:opacity-40"><Phone className="w-4 h-4 text-blue-500" />اتصال</button>
              {!isFree && (
                <button type="button" onClick={handleQuickPayment} className={`py-3 rounded-2xl text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm ${isPaid ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}><CheckCircle2 className="w-4 h-4" />{isPaid ? 'إلغاء التسديد' : 'تسديد'}</button>
              )}
            </div>

            {!isPaid && !isFree && (
              <button type="button" onClick={() => { setCustomAmount(String(outstanding || currentCalc.total)); setCustomError(''); setIsAdvancedOpen(true); }} className="mt-2.5 w-full py-3 rounded-2xl bg-slate-100 dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><Sliders className="w-4 h-4 text-blue-500" />تسديد مخصص / جزئي</button>
            )}

            <button type="button" onClick={() => setActiveView('history')} className="mt-2.5 w-full py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><History className="w-4 h-4 text-blue-500" />سجل الدفعات والفواتير ({subscriberToEdit.invoicesHistory?.length || 0})</button>

            {onDeleteSubscriber && (
              <button type="button" onClick={() => setIsConfirmDeleteOpen(true)} className="mt-3 w-full py-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/5 text-rose-600 text-xs font-black flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف المشترك</button>
            )}
          </div>
        ) : activeView === 'history' && subscriberToEdit ? (
          <div className="min-h-full p-4 sm:p-5 pb-8">
            <div className="grid grid-cols-3 items-center mb-4">
              <button type="button" onClick={() => setActiveView('profile')} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">رجوع</button>
              <h2 className="text-center text-sm font-black text-slate-950 dark:text-white">سجل الفواتير</h2>
              <button type="button" onClick={onClose} className="justify-self-end w-9 h-9 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {!subscriberToEdit.invoicesHistory?.length ? (
              <div className="py-14 text-center bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl"><History className="w-10 h-10 mx-auto text-slate-300 mb-2" /><p className="text-xs font-bold text-slate-500">لا توجد فواتير مسجلة لهذا المشترك.</p></div>
            ) : (
              <div className="space-y-2.5">
                {subscriberToEdit.invoicesHistory.map(inv => (
                  <div key={inv.id} className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="font-black text-xs text-slate-950 dark:text-white truncate">{inv.monthNameAr}</div><div className="text-[10px] text-slate-400 mt-1">{inv.receiptNumber || inv.issueDate}</div><div className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-1">{formatCurrency(inv.paidAmount || 0)}</div></div>
                    <button type="button" onClick={() => onOpenReceiptModal?.(subscriberToEdit, inv)} className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-black flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />فتح الوصل</button>
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
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">فئة الاشتراك</label><select value={tier} onChange={e => setTier(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">{pricingTiers.map(t => <option key={t.id} value={t.id}>{t.nameAr}</option>)}</select></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" />الكابينة</label><select value={line} onChange={e => setLine(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">{lines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
            </div>
            <button type="submit" className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md">{subscriberToEdit ? 'حفظ التعديلات' : 'إضافة المشترك'}</button>
          </form>
        )}

        {isAdvancedOpen && subscriberToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" dir="rtl">
            <div className="w-full max-w-md bg-white dark:bg-[#101a33] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-black text-slate-950 dark:text-white">التسديد المخصص</h3><p className="text-[10px] text-slate-400 mt-1">المتبقي حالياً: {formatCurrency(outstanding)}</p></div><button type="button" onClick={() => setIsAdvancedOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button></div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">مبلغ الدفعة</label>
              <input type="number" min="1" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setCustomError(''); }} className="mt-1.5 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-slate-950 dark:text-white outline-none focus:border-blue-500" dir="ltr" />
              {customError && <p className="text-[11px] font-bold text-rose-500 mt-2">{customError}</p>}
              <button type="button" onClick={() => { const amount = Number(customAmount); if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) { setCustomError(`أدخل مبلغاً بين 1 و ${formatNum(outstanding)} د.ع`); return; } handleCustomPayment('partial', amount); }} className="mt-4 w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black">تسديد المبلغ وإصدار الوصل</button>
              <button type="button" onClick={() => handleCustomPayment('free', 0)} className="mt-2 w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-slate-700">إعفاء الشهر الحالي</button>
            </div>
          </div>
        )}

        {isConfirmUnpaidOpen && subscriberToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-sm bg-white dark:bg-[#101a33] rounded-3xl p-5 text-center border border-rose-200 dark:border-rose-900/50 shadow-2xl"><AlertTriangle className="w-9 h-9 text-rose-500 mx-auto" /><h3 className="mt-3 text-sm font-black text-slate-950 dark:text-white">إلغاء تسديد الشهر الحالي؟</h3><p className="mt-1 text-[11px] text-slate-500">تبقى الديون والفواتير السابقة محفوظة.</p><div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={() => setIsConfirmUnpaidOpen(false)} className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">تراجع</button><button type="button" onClick={executeUnpaidAction} className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black">تأكيد الإلغاء</button></div></div></div>
        )}

        {isConfirmDeleteOpen && subscriberToEdit && onDeleteSubscriber && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-sm bg-white dark:bg-[#101a33] rounded-3xl p-5 text-center border border-rose-200 dark:border-rose-900/50 shadow-2xl"><Trash2 className="w-9 h-9 text-rose-500 mx-auto" /><h3 className="mt-3 text-sm font-black text-slate-950 dark:text-white">حذف المشترك نهائياً؟</h3><p className="mt-1 text-[11px] text-slate-500">لا يمكن التراجع عن عملية الحذف.</p><div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={() => setIsConfirmDeleteOpen(false)} className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200">تراجع</button><button type="button" onClick={handleDelete} className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black">حذف</button></div></div></div>
        )}
      </div>
    </div>
  );
};

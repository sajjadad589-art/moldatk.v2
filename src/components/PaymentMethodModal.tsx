import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  Coins,
  HeartHandshake,
  Printer,
  ChevronDown,
  Banknote,
  SlidersHorizontal,
} from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, Collector } from '../types';
import { formatCurrency, formatNumberArabic, calculateSubscriberBill } from '../utils/formatters';

export type PaymentExecutionMethod = 'full' | 'partial' | 'free' | 'unpaid';

export interface PaymentExecutionData {
  subscriberId: string;
  method: PaymentExecutionMethod;
  amountPaid: number;
  remainingAmount: number;
  cancellationReason?: string;
  freeReason?: string;
  collectorName?: string;
  notes?: string;
  autoPrintReceipt?: boolean;
}

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  pricingTiers: SubscriptionTierPricing[];
  collectors: Collector[];
  onConfirmPayment: (data: PaymentExecutionData) => void;
  currency?: string;
}

type CustomPaymentMethod = '' | 'partial' | 'free';

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  pricingTiers,
  collectors,
  onConfirmPayment,
  currency = 'د.ع',
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentExecutionMethod>('full');
  const [customPaymentOpen, setCustomPaymentOpen] = useState(false);
  const [customMethod, setCustomMethod] = useState<CustomPaymentMethod>('');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [collectorName, setCollectorName] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState<boolean>(true);

  useEffect(() => {
    if (!subscriber) return;

    const calc = calculateSubscriberBill(subscriber.amperes, subscriber.tier, pricingTiers);
    const totalDue = subscriber.amountDue > 0 ? subscriber.amountDue : calc.total;

    // التسديد النقدي الكامل هو الخيار الافتراضي دائماً عند فتح النافذة.
    setSelectedMethod('full');
    setCustomPaymentOpen(false);
    setCustomMethod('');
    setPartialAmount(totalDue);
    setCollectorName(collectors[0]?.name || 'مدير النظام');
    setNotes(subscriber.notes || '');
    setReason('');
    setAutoPrint(true);
  }, [subscriber, isOpen, pricingTiers, collectors]);

  if (!isOpen || !subscriber) return null;

  const calc = calculateSubscriberBill(subscriber.amperes, subscriber.tier, pricingTiers);
  const totalAmountDue = subscriber.amountDue > 0 ? subscriber.amountDue : calc.total;
  const currentTier = pricingTiers.find(p => p.type === subscriber.tier);

  let computedAmountPaid = 0;
  let computedRemaining = 0;

  if (selectedMethod === 'full') {
    computedAmountPaid = totalAmountDue;
    computedRemaining = 0;
  } else if (selectedMethod === 'partial') {
    computedAmountPaid = Math.min(totalAmountDue, Math.max(0, Number(partialAmount) || 0));
    computedRemaining = Math.max(0, totalAmountDue - computedAmountPaid);
  } else if (selectedMethod === 'free') {
    computedAmountPaid = 0;
    computedRemaining = 0;
  } else {
    computedAmountPaid = 0;
    computedRemaining = totalAmountDue;
  }

  const chooseCashPayment = () => {
    setSelectedMethod('full');
    setCustomPaymentOpen(false);
    setCustomMethod('');
    setReason('');
    setPartialAmount(totalAmountDue);
  };

  const toggleCustomPayment = () => {
    const next = !customPaymentOpen;
    setCustomPaymentOpen(next);
    if (!next) {
      chooseCashPayment();
    }
  };

  const handleCustomMethodChange = (value: CustomPaymentMethod) => {
    setCustomMethod(value);
    setReason('');

    if (value === 'partial') {
      setSelectedMethod('partial');
      const defaultPartial = Math.max(1000, Math.min(totalAmountDue, Math.round(totalAmountDue / 2 / 1000) * 1000));
      setPartialAmount(defaultPartial);
    } else if (value === 'free') {
      setSelectedMethod('free');
      setPartialAmount(0);
    } else {
      setSelectedMethod('full');
      setPartialAmount(totalAmountDue);
    }
  };

  const handleApplyPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMethod === 'free' && !reason.trim()) return;
    if (selectedMethod === 'partial' && computedAmountPaid <= 0) return;

    onConfirmPayment({
      subscriberId: subscriber.id,
      method: selectedMethod,
      amountPaid: computedAmountPaid,
      remainingAmount: computedRemaining,
      freeReason: selectedMethod === 'free' ? reason.trim() : undefined,
      collectorName: collectorName || collectors[0]?.name || 'مدير النظام',
      notes: notes.trim() || undefined,
      autoPrintReceipt: autoPrint,
    });

    onClose();
  };

  const handleSetPresetPercentage = (percentage: number) => {
    const calculated = Math.round((totalAmountDue * percentage) / 1000) * 1000;
    setPartialAmount(Math.max(1000, Math.min(totalAmountDue, calculated)));
  };

  const actionLabel = selectedMethod === 'full'
    ? `تأكيد التسديد النقدي ${formatCurrency(totalAmountDue, currency)}`
    : selectedMethod === 'partial'
      ? `تأكيد التسديد المقطوع ${formatCurrency(computedAmountPaid, currency)}`
      : 'تأكيد التسديد المجاني';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        id="payment-method-modal"
        className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[94vh]"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">طريقة التسديد وتسجيل الدفعة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">التسديد النقدي هو الخيار الافتراضي</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleApplyPayment} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                {subscriber.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{subscriber.fullName}</h4>
                  <span className="font-mono text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                    {subscriber.code}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    {formatNumberArabic(subscriber.amperes)} أمبير ({currentTier?.nameAr || subscriber.tier})
                  </span>
                  <span>•</span>
                  <span>{subscriber.lineName}</span>
                </div>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">إجمالي الفاتورة:</span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                {subscriber.tier === 'free' ? '0 د.ع' : formatCurrency(totalAmountDue, currency)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={chooseCashPayment}
              className={`w-full min-h-[86px] p-4 rounded-2xl border-2 text-right transition-all flex items-center justify-between gap-4 cursor-pointer ${
                selectedMethod === 'full' && !customPaymentOpen
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/35 shadow-md ring-2 ring-emerald-400/25'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">التسديد النقدي</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">تسديد كامل المبلغ المستحق نقداً</div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(totalAmountDue, currency)}</div>
                <div className="text-[10px] font-bold text-slate-400">الافتراضي</div>
              </div>
            </button>

            <button
              type="button"
              onClick={toggleCustomPayment}
              className={`w-full min-h-[68px] p-4 rounded-2xl border-2 text-right transition-all flex items-center justify-between gap-4 cursor-pointer ${
                customPaymentOpen
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">تسديد مخصص</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">تسديد مقطوع أو تسديد مجاني</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${customPaymentOpen ? 'rotate-180' : ''}`} />
            </button>

            {customPaymentOpen && (
              <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3 animate-in fade-in slide-in-from-top-1">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">نوع التسديد المخصص</label>
                <select
                  value={customMethod}
                  onChange={e => handleCustomMethodChange(e.target.value as CustomPaymentMethod)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  required={customPaymentOpen}
                >
                  <option value="">اختر طريقة التسديد</option>
                  <option value="partial">تسديد مقطوع</option>
                  <option value="free">تسديد مجاني</option>
                </select>
              </div>
            )}
          </div>

          {selectedMethod === 'partial' && customPaymentOpen && (
            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>مبلغ التسديد المقطوع:</span>
                </label>
                <span className="text-[11px] font-bold text-slate-500">المستحق {formatCurrency(totalAmountDue, currency)}</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={totalAmountDue}
                  step={1000}
                  value={partialAmount}
                  onChange={e => setPartialAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="أدخل المبلغ"
                  required
                />
                <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">د.ع</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">اختيارات سريعة:</span>
                {[
                  { label: '25%', percent: 25 },
                  { label: '50%', percent: 50 },
                  { label: '75%', percent: 75 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSetPresetPercentage(preset.percent)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/60 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold">المسدد</span>
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-200 tabular-nums">{formatCurrency(computedAmountPaid, currency)}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                  <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-bold">المتبقي</span>
                  <span className="text-xs font-black text-rose-800 dark:text-rose-200 tabular-nums">{formatCurrency(computedRemaining, currency)}</span>
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'free' && customPaymentOpen && (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-2 animate-in fade-in">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-purple-500" />
                <span>سبب التسديد المجاني <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="مثال: جامع، عائلة شهيد، نقطة حراسة، خدمة..."
                className="w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">لا يمكن اعتماد التسديد المجاني بدون ذكر السبب.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المحصل / الجابي المستلم:</label>
              <select
                value={collectorName}
                onChange={e => setCollectorName(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none"
              >
                {collectors.map(c => (
                  <option key={c.id} value={c.name}>{c.name} ({c.assignedLineName})</option>
                ))}
                <option value="مدير المحطة">مدير المحطة المباشر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية:</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="مثال: تم الاستلام نقداً في الموقع"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={e => setAutoPrint(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Printer className="w-4 h-4 text-blue-500" />
              <span>طباعة وصل الاستلام بعد نجاح التسديد</span>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98] cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={customPaymentOpen && !customMethod}
              className={`min-h-[52px] w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-white text-sm font-black border-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedMethod === 'partial'
                  ? 'bg-gradient-to-b from-amber-500 to-amber-700 border-amber-300/70 shadow-amber-950/25'
                  : selectedMethod === 'free'
                    ? 'bg-gradient-to-b from-slate-600 to-slate-800 border-slate-400/70 shadow-slate-950/25'
                    : 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-300/70 shadow-emerald-950/25'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{actionLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

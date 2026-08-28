import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  FileX2,
  CheckCircle,
  RotateCcw,
  User,
  Hash,
  DollarSign,
  Calendar,
  MessageSquareWarning,
} from 'lucide-react';
import { Subscriber } from '../types';
import { formatCurrency, formatNumberArabic } from '../utils/formatters';

interface PaymentCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onConfirmCancellation: (subscriberId: string, reason: string) => void;
  currency?: string;
}

const PRESET_REASONS = [
  'خطأ في إدخال المشترك أو رقم القاطع',
  'استرجاع المبلغ للمشترك بطلب منه لظرف خاص',
  'تعديل عدد الأمبيرات أو فئة الاشتراك',
  'تسجيل دفع مكرر بالخطأ',
  'لم يتم استلام المبلغ نقداً من الجابي الميداني',
];

export const PaymentCancellationModal: React.FC<PaymentCancellationModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onConfirmCancellation,
  currency = 'د.ع',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !subscriber) return null;

  const currentReason = customReason.trim() || selectedPreset;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReason) {
      setErrorMsg('يرجى اختيار أو كتابة سبب إلغاء التسديد لتوثيقه في سجل الإيصالات الملغاة.');
      return;
    }

    onConfirmCancellation(subscriber.id, currentReason);
    setSelectedPreset('');
    setCustomReason('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#0c1631] w-full max-w-lg rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black shrink-0">
              <FileX2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>إلغاء تسديد الاشتراك وتوثيق السبب</span>
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                سيتم توثيق هذا الإيصال كـ (إيصال ملغي) في ملف المشترك وسجل الحركات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>تنبيه أمان وتوثيق مالي:</span>
            </div>
            <p>
              عند تأكيد الإلغاء، ستتحول حالة المشترك إلى <strong>غير مسدد</strong>، ويبقى الإيصال محفوظاً في سجل فواتير المشترك مع وسم <strong>(إيصال ملغي)</strong> مع تاريخ الإلغاء والسبب المدخل أدناه.
            </p>
          </div>

          {/* Subscriber summary card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">المشترك:</span>
              <span className="font-bold text-slate-900 dark:text-white">{subscriber.fullName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">الكود والقاطع:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {subscriber.code} • {subscriber.boxNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">المبلغ المُلغى:</span>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                {formatCurrency(subscriber.amountPaid || subscriber.amountDue, currency)}
              </span>
            </div>
          </div>

          {/* Quick Preset Reasons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              اختر سبباً شائعاً للإلغاء:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset, idx) => {
                const isSelected = selectedPreset === preset && !customReason;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset);
                      setCustomReason('');
                      setErrorMsg('');
                    }}
                    className={`text-[11px] px-2.5 py-1.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500 text-white border-rose-500 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Reason Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>أو اكتب سبباً مخصصاً / ملاحظة إضافية: <span className="text-rose-500">*</span></span>
              {selectedPreset && <span className="text-[10px] text-slate-400 font-normal">(تم اختيار سبب مقترح)</span>}
            </label>
            <textarea
              rows={3}
              value={customReason}
              onChange={e => {
                setCustomReason(e.target.value);
                if (e.target.value) setSelectedPreset('');
                setErrorMsg('');
              }}
              placeholder="اكتب هنا تفاصيل سبب إلغاء التسديد..."
              className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs resize-none"
            />
            {errorMsg && (
              <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                <MessageSquareWarning className="w-3.5 h-3.5" />
                {errorMsg}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            تراجع وإبقاء التسديد
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <FileX2 className="w-4 h-4" />
            <span>تأكيد الإلغاء وتوثيق الإيصال الملغي ⚠️</span>
          </button>
        </div>
      </div>
    </div>
  );
};

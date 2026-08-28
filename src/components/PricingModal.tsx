import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Save,
  Calculator,
  Zap,
  Shield,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Layers,
  History,
  Lock,
} from 'lucide-react';
import { SubscriptionTierPricing, MonthlyTariffRecord } from '../types';
import { formatCurrency, formatNumberArabic } from '../utils/formatters';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pricingTiers: SubscriptionTierPricing[];
  monthlyTariffs: MonthlyTariffRecord[];
  onSaveMonthlyTariffs: (
    updatedTariffs: MonthlyTariffRecord[],
    activeMonthId: string,
    shouldRecalculateBills: boolean
  ) => void;
  currency: string;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  pricingTiers,
  monthlyTariffs,
  onSaveMonthlyTariffs,
  currency,
}) => {
  const [tariffs, setTariffs] = useState<MonthlyTariffRecord[]>(monthlyTariffs);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-08');
  const [simulatedAmperes, setSimulatedAmperes] = useState<number>(5);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isAddingNewMonth, setIsAddingNewMonth] = useState<boolean>(false);
  const [newMonthNumber, setNewMonthNumber] = useState<number>(9);
  const [newYearNumber, setNewYearNumber] = useState<number>(2026);

  // Month Names in Arabic
  const monthNamesArabic = [
    'كانون الثاني (شهر 1)',
    'شباط (شهر 2)',
    'آذار (شهر 3)',
    'نيسان (شهر 4)',
    'أيار (شهر 5)',
    'حزيران (شهر 6)',
    'تموز (شهر 7)',
    'آب (شهر 8)',
    'أيلول (شهر 9)',
    'تشرين الأول (شهر 10)',
    'تشرين الثاني (شهر 11)',
    'كانون الأول (شهر 12)',
  ];

  useEffect(() => {
    if (isOpen) {
      if (monthlyTariffs && monthlyTariffs.length > 0) {
        setTariffs(monthlyTariffs);
        const active = monthlyTariffs.find(m => m.isCurrentActive) || monthlyTariffs[0];
        setSelectedMonthId(active.id);
      } else {
        const defaultRecord: MonthlyTariffRecord = {
          id: '2026-08',
          month: 8,
          year: 2026,
          monthNameAr: 'شهر 8 (آب 2026)',
          tiers: pricingTiers.map(t => ({ ...t, fixedFee: 0 })),
          createdAt: new Date().toISOString().split('T')[0],
          isCurrentActive: true,
        };
        setTariffs([defaultRecord]);
        setSelectedMonthId(defaultRecord.id);
      }
      setSavedSuccess(false);
      setIsAddingNewMonth(false);
    }
  }, [isOpen, monthlyTariffs, pricingTiers]);

  if (!isOpen) return null;

  const currentMonthRecord = tariffs.find(m => m.id === selectedMonthId) || tariffs[0];
  const currentTiers = currentMonthRecord?.tiers || [];
  const isEditable = currentMonthRecord?.isCurrentActive === true;

  // إدخال الرقم البسيط (مثلاً 12 ليصبح 12000)
  const handlePriceChange = (tierId: string, val: number) => {
    if (!isEditable) return;
    const fullValue = val * 1000; // تحويل الرقم البسيط إلى آلاف تلقائياً
    setTariffs(prevTariffs =>
      prevTariffs.map(month => {
        if (month.id !== selectedMonthId) return month;
        return {
          ...month,
          tiers: month.tiers.map(t =>
            t.id === tierId ? { ...t, pricePerAmpere: Math.max(0, fullValue), fixedFee: 0 } : t
          ),
        };
      })
    );
  };

  const handleNameChange = (tierId: string, val: string) => {
    if (!isEditable) return;
    setTariffs(prevTariffs =>
      prevTariffs.map(month => {
        if (month.id !== selectedMonthId) return month;
        return {
          ...month,
          tiers: month.tiers.map(t => (t.id === tierId ? { ...t, nameAr: val } : t)),
        };
      })
    );
  };

  const handleToggle24h = (tierId: string) => {
    if (!isEditable) return;
    setTariffs(prevTariffs =>
      prevTariffs.map(month => {
        if (month.id !== selectedMonthId) return month;
        return {
          ...month,
          tiers: month.tiers.map(t =>
            t.id === tierId ? { ...t, is24Hours: !t.is24Hours } : t
          ),
        };
      })
    );
  };

  const handleAddNewTier = () => {
    if (!isEditable) return;
    const newId = `tier-custom-${Date.now()}`;
    const newTier: SubscriptionTierPricing = {
      id: newId,
      nameAr: `فئة اشتراك جديدة (${currentTiers.length + 1})`,
      nameEn: 'Custom Tier',
      type: 'custom',
      pricePerAmpere: 15000,
      fixedFee: 0,
      description: '',
      badgeColor: 'blue',
      is24Hours: false,
      priorityLevel: currentTiers.length + 1,
    };

    setTariffs(prevTariffs =>
      prevTariffs.map(month => {
        if (month.id !== selectedMonthId) return month;
        return {
          ...month,
          tiers: [...month.tiers, newTier],
        };
      })
    );
  };

  const handleDeleteTier = (tierId: string) => {
    if (!isEditable || currentTiers.length <= 1) return;
    setTariffs(prevTariffs =>
      prevTariffs.map(month => {
        if (month.id !== selectedMonthId) return month;
        const updated = month.tiers.filter(t => t.id !== tierId);
        return { ...month, tiers: updated };
      })
    );
  };

  const handleCreateNewMonthTariff = () => {
    const monthId = `${newYearNumber}-${String(newMonthNumber).padStart(2, '0')}`;
    const exists = tariffs.some(m => m.id === monthId);
    if (exists) {
      setSelectedMonthId(monthId);
      setIsAddingNewMonth(false);
      return;
    }

    const monthLabel = `شهر ${newMonthNumber} (${monthNamesArabic[newMonthNumber - 1]} ${newYearNumber})`;
    const baseTiers = currentTiers.map(t => ({ ...t, fixedFee: 0, description: '' }));

    const newRecord: MonthlyTariffRecord = {
      id: monthId,
      month: newMonthNumber,
      year: newYearNumber,
      monthNameAr: monthLabel,
      tiers: baseTiers,
      createdAt: new Date().toISOString().split('T')[0],
      isCurrentActive: true,
    };

    const updatedTariffs = [
      newRecord,
      ...tariffs.map(m => ({ ...m, isCurrentActive: false })),
    ];

    setTariffs(updatedTariffs);
    setSelectedMonthId(monthId);
    setIsAddingNewMonth(false);
  };

  const handleDeleteMonth = (monthId: string) => {
    if (tariffs.length <= 1) return;
    const remaining = tariffs.filter(m => m.id !== monthId);
    if (remaining.length > 0) {
      if (!remaining.some(m => m.isCurrentActive)) {
        remaining[0].isCurrentActive = true;
      }
      setTariffs(remaining);
      setSelectedMonthId(remaining[0].id);
    }
  };

  const handleSave = () => {
    if (!isEditable) {
      onClose();
      return;
    }
    // تفعيل الحماية تلقائياً (true)
    onSaveMonthlyTariffs(tariffs, selectedMonthId, true);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const getTierIcon = (type: string) => {
    switch (type) {
      case 'golden':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'commercial':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'free':
        return <Shield className="w-4 h-4 text-purple-500" />;
      default:
        return <Layers className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto font-['Cairo']" dir="rtl">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                إدارة وتسعيرة الاشتراكات الشهرية
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                تحديد وحفظ تسعيرة كل شهر مع حماية تلقائية للمبالغ المسددة للمشتركين
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Month Selector Bar */}
          <div className="bg-slate-100/80 dark:bg-slate-900/90 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  أشهر التسعيرة المحفوظة بالسجل:
                </span>
              </div>

              <button
                onClick={() => setIsAddingNewMonth(!isAddingNewMonth)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة تسعيرة شهر جديد</span>
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {tariffs.map(month => {
                const isSelected = selectedMonthId === month.id;
                return (
                  <div
                    key={month.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                    onClick={() => setSelectedMonthId(month.id)}
                  >
                    <span>{month.monthNameAr}</span>
                    {month.isCurrentActive && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-400 text-slate-950 font-black">
                        النشط
                      </span>
                    )}

                    {tariffs.length > 1 && !month.isCurrentActive && (
                      <button
                        title="حذف هذا الشهر من السجل"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteMonth(month.id);
                        }}
                        className="p-0.5 hover:text-rose-300 transition-colors ml-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isAddingNewMonth && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الشهر:</span>
                  <select
                    value={newMonthNumber}
                    onChange={e => setNewMonthNumber(parseInt(e.target.value))}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none"
                  >
                    {monthNamesArabic.map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">السنة:</span>
                  <input
                    type="number"
                    value={newYearNumber}
                    onChange={e => setNewYearNumber(parseInt(e.target.value) || 2026)}
                    className="w-20 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 mr-auto">
                  <button
                    onClick={handleCreateNewMonthTariff}
                    className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    اعتماد وإضافة كشهر نشط جديد
                  </button>
                  <button
                    onClick={() => setIsAddingNewMonth(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Read-Only / Active Banner */}
          <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
            isEditable 
              ? 'bg-blue-50/70 dark:bg-[#111c38] border-blue-200 dark:border-blue-900/60' 
              : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
          }`}>
            <div className="flex items-center gap-2.5">
              {isEditable ? (
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block flex items-center gap-2">
                  <span>تسعيرة: {currentMonthRecord?.monthNameAr}</span>
                  {!isEditable && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] font-bold">
                      أرشيف (للقراءة فقط)
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isEditable
                    ? 'هذا هو الشهر النشط حالياً لإصدار فواتير المشتركين وقابل للتعديل'
                    : 'هذا الشهر يعتبر أرشيفاً سابقاً، الأسعار هنا للقراءة فقط ولا يمكن تعديلها.'}
                </span>
              </div>
            </div>
          </div>

          {/* Tier Cards Configuration (بدون رسوم ثابتة، وإدخال الرقم البسيط) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                فئات الاشتراكات والأسعار لـ ({currentMonthRecord?.monthNameAr}):
              </span>

              {isEditable && (
                <button
                  onClick={handleAddNewTier}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>إضافة نوع خط / فئة جديدة</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currentTiers.map((tier) => {
                const isFree = tier.type === 'free';
                // عرض الرقم بالآلاف بشكل مبسط في الحقل (مثلاً 12000 تصبح 12)
                const simplifiedPrice = tier.pricePerAmpere > 0 ? Math.round(tier.pricePerAmpere / 1000) : 0;

                return (
                  <div
                    key={tier.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isEditable 
                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90' 
                        : 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 opacity-90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                          {getTierIcon(tier.type)}
                        </div>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={tier.nameAr}
                          onChange={e => handleNameChange(tier.id, e.target.value)}
                          className="font-bold text-sm text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 outline-none w-full px-1 disabled:opacity-80"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          <input
                            type="checkbox"
                            disabled={!isEditable}
                            checked={tier.is24Hours}
                            onChange={() => handleToggle24h(tier.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-50"
                          />
                          <span>24 ساعة</span>
                        </label>

                        {isEditable && currentTiers.length > 1 && (
                          <button
                            onClick={() => handleDeleteTier(tier.id)}
                            title="حذف هذا النوع"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        سعر الأمبير ({currency})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          disabled={!isEditable || isFree}
                          value={simplifiedPrice}
                          onChange={e =>
                            handlePriceChange(
                              tier.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full pl-16 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black tabular-nums outline-none disabled:opacity-60"
                        />
                        <span className="absolute left-3 top-1.5 text-[11px] text-slate-400 font-bold">
                          ألف {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Simulator Widget */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 border border-blue-800 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                <span className="text-xs sm:text-sm font-bold">محاكي الفاتورة التقديرية الفوري</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-200 font-medium">عدد الأمبيرات:</span>
                <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/20">
                  {[3, 5, 8, 10, 15].map(amp => (
                    <button
                      key={amp}
                      onClick={() => setSimulatedAmperes(amp)}
                      className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                        simulatedAmperes === amp
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-blue-200 hover:text-white'
                      }`}
                    >
                      {formatNumberArabic(amp)}A
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {currentTiers.map(t => {
                const total = t.type === 'free' ? 0 : simulatedAmperes * t.pricePerAmpere;
                return (
                  <div key={t.id} className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[11px] text-blue-200 block truncate font-bold">{t.nameAr}</span>
                    <span className="text-sm sm:text-base font-extrabold text-white block mt-0.5 tabular-nums">
                      {formatCurrency(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* تنبيه الحماية التلقائية */}
          {isEditable && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-2 text-xs">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                حماية الحسابات المسددة مفعلة تلقائياً: لن يتم المساس بالمبالغ الخاصة بالمشتركين الذين قاموا بالسداد بالكامل.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer (بدون زر الاسترجاع) */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          {isEditable && (
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all cursor-pointer ${
                savedSuccess
                  ? 'bg-emerald-600 shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  تم حفظ وتطبيق التسعيرة!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  حفظ وتطبيق التسعيرة (مع الحماية التلقائية)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
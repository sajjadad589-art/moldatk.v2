import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowRight,
  Calendar,
  Filter,
  User,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Subscriber, Collector, AuditLogEntry } from '../types';

interface WalletViewProps {
  subscribers: Subscriber[];
  collectors: Collector[];
  auditLogs?: AuditLogEntry[];
  walletResetTimestamp?: string;
  currency?: string;
  onBack: () => void;
  onClearWalletLogs?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  subscribers,
  collectors,
  auditLogs = [],
  walletResetTimestamp,
  currency = 'د.ع',
  onBack,
  onClearWalletLogs,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'payment' | 'cancellation'>('all');
  const [selectedCollector, setSelectedCollector] = useState<string>('all');
  
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(null);

  const [isCollectorOpen, setIsCollectorOpen] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState<boolean>(false);

  // تم تقليل وقت العداد التحذيري إلى 3 ثواني
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    let timer: any;
    if (isConfirmResetOpen) {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isConfirmResetOpen]);

  const [currentMonth, setCurrentMonth] = useState<number>(7);
  const [currentYear, setCurrentYear] = useState<number>(2026);

  const monthNamesAr = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const daysArray = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handleDateClick = (dateStr: string) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(dateStr);
      setTempEndDate(null);
    } else if (tempStartDate && !tempEndDate) {
      if (dateStr < tempStartDate) {
        setTempStartDate(dateStr);
      } else {
        setTempEndDate(dateStr);
      }
    }
  };

  const resetTimeMs = walletResetTimestamp ? new Date(walletResetTimestamp).getTime() : 0;

  const financialLogs = auditLogs.filter(log => {
    if (log.category !== 'payment' && log.category !== 'cancellation' && log.category !== 'pricing') return false;
    
    if (resetTimeMs > 0 && log.timestamp) {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime < resetTimeMs) return false;
    }
    return true;
  });

  const filteredLogs = financialLogs.filter(log => {
    if (filterType === 'payment' && log.category !== 'payment') return false;
    if (filterType === 'cancellation' && log.category !== 'cancellation') return false;
    if (selectedCollector !== 'all' && log.actorName !== selectedCollector) return false;
    
    if (startDate && log.timestamp && log.timestamp.split('T')[0] < startDate) return false;
    if (endDate && log.timestamp && log.timestamp.split('T')[0] > endDate) return false;

    return true;
  });

  const totalCollected = financialLogs
    .filter(log => log.category === 'payment')
    .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);

  return (
    <div className="space-y-6 font-['Cairo'] max-w-5xl mx-auto pb-10 text-slate-900 dark:text-white" dir="rtl">
      
      <div className="flex items-center justify-between bg-white dark:bg-[#131E38] p-5 rounded-3xl border border-slate-200 dark:border-blue-900/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">القاصة (المحفظة المالية)</h1>
            <p className="text-xs text-slate-400">إدارة ومتابعة التدفقات النقدية وسجل العمليات المالية</p>
          </div>
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </button>
      </div>

      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/30 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-400 block mb-1">الرصيد الحالي في القاصة</span>
            <span className="text-3xl font-black tabular-nums text-white">
              {totalCollected.toLocaleString()} {currency}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsConfirmResetOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-black transition-all cursor-pointer shadow-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>تصفير القاصة</span>
        </button>
      </div>

      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-md space-y-5 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-3.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">تنبيه تصفير القاصة</h3>
              
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 text-right">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                  سيتم تصفير القاصة وهذا الزر مخصص للأستعمال بعد اكمال التحاسب مع المحاسبين لتنظيم عملية التحاسب الشهريه.
                </p>
                <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                  هل انت متأكد من رغبتك بتصفير القاصة ؟
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsConfirmResetOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              
              <button
                disabled={countdown > 0}
                onClick={() => {
                  if (onClearWalletLogs) {
                    onClearWalletLogs();
                  }
                  setIsConfirmResetOpen(false);
                }}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${
                  countdown > 0 
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-70' 
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25 cursor-pointer'
                }`}
              >
                {countdown > 0 ? `يرجى القراءة (${countdown}ث)` : 'تأكيد التصفير'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 rounded-3xl p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
            <FileText className="w-5 h-5 text-blue-500" />
            <span>سجل المحفظة والعمليات المالية</span>
          </h3>

          <div className="flex flex-wrap items-center gap-3 relative">
            
            <div className="relative">
              <button
                onClick={() => { setIsDateModalOpen(true); setIsFilterOpen(false); setIsCollectorOpen(false); setTempStartDate(startDate); setTempEndDate(endDate); }}
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{startDate && endDate ? `${startDate} إلى ${endDate}` : startDate ? `من ${startDate}` : 'التاريخ'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isDateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
                  <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm space-y-5">
                    
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">اختر التاريخ</h4>
                      <button onClick={() => setIsDateModalOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-2">
                      <button
                        onClick={() => {
                          if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
                          else setCurrentMonth(m => m - 1);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {monthNamesAr[currentMonth]} {currentYear}
                      </span>
                      <button
                        onClick={() => {
                          if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
                          else setCurrentMonth(m => m + 1);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
                      <span>سبت</span><span>أحد</span><span>اثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center">
                      {Array.from({ length: (firstDayIndex + 1) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {daysArray.map(d => {
                        const dateString = d.toISOString().split('T')[0];
                        const isStart = tempStartDate === dateString;
                        const isEnd = tempEndDate === dateString;
                        const isInRange = tempStartDate && tempEndDate && dateString > tempStartDate && dateString < tempEndDate;

                        return (
                          <button
                            key={dateString}
                            onClick={() => handleDateClick(dateString)}
                            className={`h-9 w-9 mx-auto rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                              isStart || isEnd
                                ? 'bg-blue-600 text-white shadow-md'
                                : isInRange
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-none'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => { setTempStartDate(null); setTempEndDate(null); setStartDate(''); setEndDate(''); }}
                        className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                      <button
                        onClick={() => {
                          setStartDate(tempStartDate || '');
                          setEndDate(tempEndDate || tempStartDate || '');
                          setIsDateModalOpen(false);
                        }}
                        className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                      >
                        تم
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setIsFilterOpen(!isFilterOpen); setIsDateModalOpen(false); setIsCollectorOpen(false); }}
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <Filter className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {filterType === 'all' ? 'نوع العملية' : filterType === 'payment' ? 'عمليات التسديد' : 'العمليات الملغاة'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isFilterOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-20 space-y-1">
                  {[
                    { id: 'all', label: 'نوع العملية' },
                    { id: 'payment', label: 'عمليات التسديد' },
                    { id: 'cancellation', label: 'العمليات الملغاة' },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => { setFilterType(item.id as any); setIsFilterOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        filterType === item.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filterType === item.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setIsCollectorOpen(!isCollectorOpen); setIsDateModalOpen(false); setIsFilterOpen(false); }}
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <User className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{selectedCollector === 'all' ? 'المحاسبين' : selectedCollector}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isCollectorOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-20 space-y-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedCollector('all'); setIsCollectorOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedCollector === 'all' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>المحاسبين</span>
                    {selectedCollector === 'all' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  {collectors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCollector(c.name); setIsCollectorOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedCollector === c.name ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{c.name}</span>
                      {selectedCollector === c.name && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              لا توجد عمليات مالية مطابقة للفلاتر المحددة.
            </div>
          ) : (
            filteredLogs.map(log => {
              const isPayment = log.category === 'payment';
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 transition-all hover:border-blue-500/30"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-xl ${isPayment ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {isPayment ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        {log.title}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 block mt-0.5">
                        {log.details}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1 font-mono">
                        المحاسب: {log.actorName || 'الإدارة'} • {new Date(log.timestamp).toLocaleString('ar-IQ')}
                      </span>
                    </div>
                  </div>

                  {log.amount !== undefined && log.amount > 0 && (
                    <span className={`text-sm font-black tabular-nums ${isPayment ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                      {isPayment ? '+' : '-'}{log.amount.toLocaleString()} {currency}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
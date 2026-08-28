import React from 'react';
import { Gauge, Fuel, Zap, Wrench, Clock, Database } from 'lucide-react';
import { GeneratorSpecs } from '../types';

interface GeneratorMonitorViewProps {
  generatorSpecs: GeneratorSpecs;
  onUpdateSpecs: (newSpecs: Partial<GeneratorSpecs>) => void;
}

const SoonBadge: React.FC = () => (
  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-500 border border-amber-500/25">
    قريباً
  </span>
);

export const GeneratorMonitorView: React.FC<GeneratorMonitorViewProps> = () => {
  const soonCards = [
    { title: 'خزان وقود الديزل', icon: Fuel, desc: 'قياس كمية الوقود المتبقية والتنبيه عند الانخفاض' },
    { title: 'الحمل الكهربائي والفولتية', icon: Zap, desc: 'متابعة الأمبير الفعلي والفولتية وحالة الحمل' },
    { title: 'صيانة الزيت والفلاتر', icon: Wrench, desc: 'تنبيه تبديل الزيت والفلاتر حسب ساعات التشغيل' },
    { title: 'سجل وصولات تفريغ وقود الديزل', icon: Database, desc: 'حفظ فواتير الوقود والمورد والكلفة الإجمالية' },
    { title: 'ساعات التشغيل', icon: Clock, desc: 'احتساب ساعات التشغيل اليومية والشهرية' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-500" />
            <span>مراقبة الحالة التشغيلية وخزان الوقود</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            هذه الصفحة مخصصة لربط بيانات المولد الفعلية لاحقاً.
          </p>
        </div>
        <SoonBadge />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {soonCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white dark:bg-[#111c38] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-h-[150px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{card.title}</h3>
                </div>
                <SoonBadge />
              </div>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">{card.desc}</p>
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 text-center text-sm font-black text-slate-400">
                قريباً
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

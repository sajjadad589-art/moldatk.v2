import React from 'react';
import { Gauge, Fuel, Zap, Wrench, Clock, Database } from 'lucide-react';
import { GeneratorSpecs } from '../../types';

interface MobileMonitorProps {
  generatorSpecs: GeneratorSpecs;
  onUpdateSpecs: (newSpecs: Partial<GeneratorSpecs>) => void;
}

export const MobileMonitor: React.FC<MobileMonitorProps> = () => {
  const items = [
    { title: 'خزان الوقود', icon: Fuel },
    { title: 'الحمل والفولتية', icon: Zap },
    { title: 'صيانة الزيت والفلاتر', icon: Wrench },
    { title: 'سجل تفريغ الكاز', icon: Database },
    { title: 'ساعات التشغيل', icon: Clock },
  ];

  return (
    <div className="p-3.5 space-y-4 pb-24">
      <div className="rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">مراقبة الحالة التشغيلية</h2>
          </div>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-500 border border-amber-500/25">قريباً</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-6">سيتم ربط بيانات المولد الفعلية لاحقاً.</p>
      </div>

      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white">{item.title}</span>
            </div>
            <span className="text-xs font-black text-amber-500">قريباً</span>
          </div>
        );
      })}
    </div>
  );
};

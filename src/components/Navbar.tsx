import React, { useState, useEffect } from 'react';
import {
  Clock,
  Zap,
} from 'lucide-react';
import { GeneratorSpecs } from '../types';

interface NavbarProps {
  darkMode: boolean;
  onToggleTheme: () => void;
  generatorSpecs: GeneratorSpecs;
  onOpenPricingModal: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleTheme,
  generatorSpecs,
  onTabChange,
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [dynamicGeneratorName, setDynamicGeneratorName] = useState<string>(generatorSpecs.generatorName || 'مولدة المحاربين');

  useEffect(() => {
    const safeName = generatorSpecs?.generatorName?.trim() || 'مولدتك';
    setDynamicGeneratorName(safeName);
  }, [generatorSpecs?.generatorName]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setTimeString(now.toLocaleTimeString('en-GB', options));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // تحديد منظور الهاتف بصورة فورية في الوضع التلقائي، مع احترام الاختيار اليدوي.
  const [isMobileView, setIsMobileView] = useState<boolean>(false);

  useEffect(() => {
    const updateView = () => {
      const mode = (localStorage.getItem('moldatk_view_mode') || 'auto') as 'auto' | 'mobile' | 'desktop';
      const narrowScreen = window.matchMedia('(max-width: 1023px)').matches;
      setIsMobileView(mode === 'mobile' || (mode === 'auto' && narrowScreen));
    };

    updateView();
    const media = window.matchMedia('(max-width: 1023px)');
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'moldatk_view_mode') updateView();
    };

    media.addEventListener?.('change', updateView);
    window.addEventListener('resize', updateView);
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(updateView, 500);

    return () => {
      media.removeEventListener?.('change', updateView);
      window.removeEventListener('resize', updateView);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="relative w-full bg-[#0B1F3B] text-white shadow-md border-b border-[#1C3654] transition-colors duration-200">
      
      {/* شريط المعلومات العلوي (يتم إعادة ترتيبة وتصغيره حصرياً في منظور الهاتف) */}
      <div className={`px-3 py-1.5 bg-[#081521] text-slate-300 text-xs border-b border-white/10 flex items-center ${isMobileView ? 'flex-col gap-1.5 px-2' : 'justify-between'}`}>
        
        {/* في وضع الهاتف: نقل أزرار الاتصال والوضع المظلم إلى الأعلى مكان النص المحذوف */}
        {isMobileView ? (
          <div className="w-full flex items-center justify-between gap-1 min-w-0">
            <div id="moldatk-sync-status-slot" className="flex items-center shrink-0" />

            <div className="flex items-center gap-1.5 bg-[#142A45]/90 p-1 rounded-full px-2.5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-blue-100">
                {darkMode ? 'DARK' : 'LIGHT'}
              </span>
              <button
                onClick={onToggleTheme}
                className="w-7 h-4 bg-blue-700 hover:bg-blue-600 rounded-full relative transition-colors cursor-pointer"
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${darkMode ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-[#142A45]/90 px-2 py-0.5 rounded-lg border border-white/10">
              <Clock className="w-3.5 h-3.5 text-[#F2B544]" />
              <span className="text-white font-mono font-bold text-xs tracking-tight tabular-nums" dir="ltr">
                {timeString}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>نظام مولدتك لإدارة الطاقة والاشتراكات</span>
              </div>
              <span className="text-[#F2B544]/60 hidden sm:inline">•</span>
              <span className="text-slate-300/80 hidden sm:inline text-[11px]">
                {generatorSpecs.ownerName}
              </span>
            </div>

            <div className="flex items-center gap-2.5 bg-[#142A45]/90 px-3 py-1 rounded-xl border border-white/10">
              <Clock className="w-4 h-4 text-[#F2B544]" />
              <span className="text-white font-mono font-black tracking-wider text-sm tabular-nums" dir="ltr">
                {timeString}
              </span>
            </div>
          </>
        )}
      </div>

      {/* شريط التنقل الرئيسي */}
      <div className={`px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4 min-w-0 ${isMobileView ? 'py-2 px-2 gap-2' : ''}`}>
        
        {/* Brand & Logo (بدون النص الإنكليزي في وضع الهاتف) */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            onClick={() => onTabChange('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className={`bg-white rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden ${isMobileView ? 'w-8 h-8 p-1' : 'w-10 h-10 p-1'}`}>
              <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className={`font-bold tracking-tight text-white flex items-center gap-1.5 ${isMobileView ? 'text-base' : 'text-xl lg:text-2xl'}`}>
                <span>مولدتك</span>
                
              </h1>
            </div>
          </div>
        </div>

        {/* صندوق اسم المولدة (تصغير الحجم والخط حصرياً ليتلاءم مع منظور الهاتف) */}
        <div className="flex items-center justify-center flex-1 px-1 min-w-0">
          <div className={`rounded-xl flex items-center gap-1.5 transition-all ${
            isMobileView ? 'px-2.5 py-1 max-w-full' : 'px-6 py-2 rounded-2xl gap-2.5'
          } ${
            darkMode 
              ? 'bg-[#081521] border border-[#F2B544]/45 text-[#F7E4AF] shadow-sm' 
              : 'bg-[#142A45] border border-[#F2B544]/45 text-[#F7E4AF] shadow-sm'
          }`}>
            <Zap className={`animate-bounce ${isMobileView ? 'w-3.5 h-3.5' : 'w-5 h-5'} ${'text-[#F2B544]'}`} />
            <span className={`font-black tracking-wide ${isMobileView ? 'text-[11px] truncate max-w-[105px]' : 'text-base lg:text-lg'}`}>
              {dynamicGeneratorName}
            </span>
          </div>
        </div>

        {/* أزرار التحكم الجانبية (تظهر فقط في وضع الحاسوب، أما في وضع الهاتف فقد تم نقلها للأعلى) */}
        {!isMobileView && (
          <div className="flex items-center gap-3 sm:gap-4">
            <div id="moldatk-sync-status-slot" className="flex items-center shrink-0" />

            <div className="flex items-center gap-2 bg-[#142A45]/90 p-1.5 rounded-full px-3 border border-white/10 shadow-sm">
              <div className={`w-3.5 h-3.5 rounded-full ${darkMode ? 'bg-indigo-400' : 'bg-yellow-400'} shadow-sm`}></div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-blue-100 hidden md:inline">
                {darkMode ? 'DARK' : 'LIGHT'}
              </span>
              <button
                onClick={onToggleTheme}
                className="w-9 h-5 bg-blue-700 hover:bg-blue-600 rounded-full relative transition-colors cursor-pointer"
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${darkMode ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
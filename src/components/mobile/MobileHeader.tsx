import React from 'react';
import {
  Moon,
  Sun,
  Sliders,
  LogOut,
} from 'lucide-react';
import { GeneratorSpecs } from '../../types';

interface MobileHeaderProps {
  generatorSpecs: GeneratorSpecs;
  darkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenPricingModal: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  generatorSpecs,
  darkMode,
  onToggleTheme,
  onLogout,
  onOpenPricingModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#1E3A8A] text-white border-b border-blue-900 shadow-md">
      {/* Top Bar: Brand, Status, and Controls */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white text-[#1E3A8A] flex items-center justify-center font-black text-base shadow-sm shrink-0">
            M
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight truncate">نظام مولدتك</h1>
              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-blue-200 truncate leading-none mt-0.5">
              {generatorSpecs.generatorName}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Pricing Quick Button */}
          <button
            onClick={onOpenPricingModal}
            className="px-2.5 py-1 rounded-xl bg-blue-950/70 hover:bg-blue-900 border border-blue-800 text-blue-100 hover:text-white transition-all flex items-center gap-1 text-[11px] font-bold"
            title="تسعيرة الأمبير"
          >
            <Sliders className="w-3 h-3 text-yellow-400" />
            <span>التسعيرة</span>
          </button>


          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-100 hover:text-white transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900 border border-blue-800 text-blue-200 hover:text-white transition-colors"
            title="تبديل المظهر"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-200" />}
          </button>
        </div>
      </div>
    </header>
  );
};

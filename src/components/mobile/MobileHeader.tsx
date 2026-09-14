import React from 'react';
import {
  Moon,
  Sun,
  Bell,
  LogOut,
} from 'lucide-react';
import { GeneratorSpecs } from '../../types';

interface MobileHeaderProps {
  generatorSpecs: GeneratorSpecs;
  darkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenPricingModal: () => void;
  showSyncStatus?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  generatorSpecs,
  darkMode,
  onToggleTheme,
  onLogout,
  onOpenPricingModal,
  showSyncStatus = false,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B1F3B] text-white border-b border-[#1C3654] shadow-md">
      {/* Top Bar: Brand, Status, and Controls */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 p-1 overflow-hidden"><img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-full h-full object-contain" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight truncate">نظام مولدتك</h1>
              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              <p className="text-[10px] text-slate-300 truncate leading-none">{generatorSpecs.generatorName}</p>
              {showSyncStatus && <div id="moldatk-sync-status-slot" className="flex items-center shrink-0 scale-[0.82] origin-right" />}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notifications Quick Button */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('moldatk-open-notifications'))}
            className="relative w-9 h-9 rounded-xl bg-[#142A45] hover:bg-[#1B3858] border border-white/10 text-white transition-all flex items-center justify-center shadow-sm"
            title="الإشعارات"
            aria-label="فتح الإشعارات"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0B1F3B]" />
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
            className="p-1.5 rounded-xl bg-[#142A45] hover:bg-[#1B3858] border border-white/10 text-slate-200 hover:text-white transition-colors"
            title="تبديل المظهر"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#F2B544]" /> : <Moon className="w-4 h-4 text-blue-200" />}
          </button>
        </div>
      </div>
    </header>
  );
};

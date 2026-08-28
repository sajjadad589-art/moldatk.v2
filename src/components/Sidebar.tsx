import React from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Fuel,
  Activity,
} from 'lucide-react';
import { GeneratorSpecs, DeviceViewMode } from '../types';
import { formatNumberArabic } from '../utils/formatters';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  generatorSpecs: GeneratorSpecs;
  onOpenNewSubscriberModal?: () => void;
  onOpenPricingModal?: () => void;
  totalSubscribersCount: number;
  isAdmin?: boolean;
  viewMode?: DeviceViewMode;
  onChangeViewMode?: (mode: DeviceViewMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  generatorSpecs,
  onOpenNewSubscriberModal,
  totalSubscribersCount,
  isAdmin = true,
  viewMode = 'auto',
}) => {
  const loadPercentage = Math.round((generatorSpecs.currentAmperes / generatorSpecs.maxAmperes) * 100);

  const navItems = [
    {
      id: 'dashboard',
      label: 'الرئيسية',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'subscribers',
      label: 'المشتركون',
      icon: Users,
      badge: `${formatNumberArabic(totalSubscribersCount)}`,
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: FolderKanban,
      badge: null,
    },
    {
      id: 'monitor',
      label: 'الوقود',
      icon: Fuel,
      badge: `${generatorSpecs.voltage}V`,
    },
  ];

  // شريط تنقل الهاتف: يظهر تلقائياً تحت lg في وضع auto، ويظهر دائماً عند فرض mobile.
  const mobileNav = (
    <nav className={`${viewMode === 'mobile' ? 'flex' : 'flex lg:hidden'} fixed bottom-0 left-0 right-0 z-50 w-full bg-white/98 dark:bg-[#0f172a]/98 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] items-center justify-around shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.2)]`}>
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`min-w-0 flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-black bg-blue-50/80 dark:bg-blue-950/60'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black leading-none whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  if (viewMode === 'mobile') return mobileNav;

  // الوضع العادي للحاسوب (أزرار جانبية في القائمة)
  return (
    <>
      {viewMode === 'auto' && mobileNav}
    <aside className="sticky top-[73px] h-[calc(100vh-73px)] w-64 shrink-0 bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hidden lg:flex select-none transition-colors overflow-y-auto">
      <div className="space-y-6">
        {isAdmin && onOpenNewSubscriberModal && (
          <div>
            <button
              type="button"
              onClick={onOpenNewSubscriberModal}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Users className="w-4 h-4 transition-transform group-hover:scale-110 text-yellow-400" />
              <span>إضافة مشترك جديد</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-2">
            القائمة الرئيسية
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#1E3A8A] dark:text-blue-400' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <span className="text-xs block truncate font-bold">{item.label}</span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isActive
                        ? 'bg-blue-200/60 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>


      </aside>
    </>
  );
};
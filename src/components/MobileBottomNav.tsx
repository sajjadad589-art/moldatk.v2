import React from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Fuel,
  Plus,
  CalendarRange,
} from 'lucide-react';
import { formatNumberArabic } from '../utils/formatters';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewSubscriberModal: () => void;
  totalSubscribersCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenNewSubscriberModal,
  totalSubscribersCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    {
      id: 'subscribers',
      label: 'المشتركون',
      icon: Users,
      badge: totalSubscribersCount > 0 ? formatNumberArabic(totalSubscribersCount) : null,
    },
    { id: 'reports', label: 'التقارير', icon: CalendarRange },
    { id: 'settings', label: 'الإعدادات', icon: FolderKanban },
    { id: 'monitor', label: 'المولد', icon: Fuel },
  ];

  const renderTab = (tab: typeof tabs[number]) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        id={`mobile-tab-${tab.id}`}
        onClick={() => onTabChange(tab.id)}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
          isActive
            ? 'text-[#1E3A8A] dark:text-blue-400 font-bold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Icon className="w-5 h-5" />
          {'badge' in tab && tab.badge && (
            <span className="absolute -top-1.5 -left-2 px-1 py-0.2 bg-blue-600 text-white text-[9px] font-black rounded-full min-w-[14px] text-center">
              {tab.badge}
            </span>
          )}
        </div>
        <span className="text-[9px] mt-1 whitespace-nowrap">{tab.label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1427]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 px-1.5 py-1.5 shadow-lg select-none">
      <div className="flex items-center justify-around max-w-md mx-auto gap-0.5">
        {tabs.slice(0, 2).map(renderTab)}

        <div className="flex-1 flex justify-center -mt-5">
          <button
            id="mobile-quick-add-btn"
            onClick={onOpenNewSubscriberModal}
            className="w-12 h-12 rounded-full bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-lg shadow-blue-900/30 flex items-center justify-center border-4 border-white dark:border-[#0c1427] active:scale-95 transition-all cursor-pointer"
            title="إضافة مشترك سريع"
          >
            <Plus className="w-6 h-6 text-yellow-400" />
          </button>
        </div>

        {tabs.slice(2).map(renderTab)}
      </div>
    </div>
  );
};

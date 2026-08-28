import React from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileDashboard } from './MobileDashboard';
import { MobileSubscribers } from './MobileSubscribers';
import { MobileMonitor } from './MobileMonitor';
import { MobileSettings } from './MobileSettings';
import { MobileBottomNav } from '../MobileBottomNav';
import {
  Subscriber,
  SubscriptionTierPricing,
  GeneratorSpecs,
  LineDistribution,
  SettingsFolderItem,
  DeviceViewMode,
} from '../../types';
import { SubscriptionInfo } from '../SubscriptionStatusUI';

interface MobileLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  folders: SettingsFolderItem[];
  darkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  viewMode: DeviceViewMode;
  onChangeViewMode: (mode: DeviceViewMode) => void;
  onOpenPricingModal: () => void;
  onOpenFolderModal: (folderKey: string) => void;
  onOpenNewSubscriberModal: () => void;
  onOpenSubscriberModal: (subscriber?: Subscriber | null) => void;
  onOpenReceiptModal: (subscriber: Subscriber) => void;
  onDeleteSubscriber: (subId: string) => void;
  onTogglePaymentStatus: (subId: string) => void;
  onUpdateSpecs: (newSpecs: Partial<GeneratorSpecs>) => void;
  onExportData: () => void;
  onResetData: () => void;
  subscriptionInfo?: SubscriptionInfo | null;
  subscriptionLoading?: boolean;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  activeTab,
  onTabChange,
  subscribers,
  pricingTiers,
  generatorSpecs,
  lines,
  folders,
  darkMode,
  onToggleTheme,
  onLogout,
  viewMode,
  onChangeViewMode,
  onOpenPricingModal,
  onOpenFolderModal,
  onOpenNewSubscriberModal,
  onOpenSubscriberModal,
  onOpenReceiptModal,
  onDeleteSubscriber,
  onTogglePaymentStatus,
  onUpdateSpecs,
  onExportData,
  onResetData,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white pb-16">
      {/* 1. Dedicated Mobile Header */}
      <MobileHeader
        generatorSpecs={generatorSpecs}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onOpenPricingModal={onOpenPricingModal}
      />

      {/* 2. Active Screen Body */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {activeTab === 'dashboard' && (
          <MobileDashboard
            subscribers={subscribers}
            pricingTiers={pricingTiers}
            generatorSpecs={generatorSpecs}
            lines={lines}
            onOpenPricingModal={onOpenPricingModal}
            onOpenNewSubscriberModal={onOpenNewSubscriberModal}
            onNavigateToTab={onTabChange}
          />
        )}

        {activeTab === 'subscribers' && (
          <MobileSubscribers
            subscribers={subscribers}
            pricingTiers={pricingTiers}
            lines={lines}
            onTogglePaymentStatus={onTogglePaymentStatus}
            onOpenSubscriberModal={onOpenSubscriberModal}
            onOpenReceiptModal={onOpenReceiptModal}
            onDeleteSubscriber={onDeleteSubscriber}
          />
        )}

        {activeTab === 'monitor' && (
          <MobileMonitor
            generatorSpecs={generatorSpecs}
            onUpdateSpecs={onUpdateSpecs}
          />
        )}

        {activeTab === 'settings' && (
          <MobileSettings
            viewMode={viewMode}
            onChangeViewMode={onChangeViewMode}
            darkMode={darkMode}
            onToggleTheme={onToggleTheme}
            pricingTiers={pricingTiers}
            generatorSpecs={generatorSpecs}
            lines={lines}
            folders={folders}
            onOpenPricingModal={onOpenPricingModal}
            onOpenFolderModal={onOpenFolderModal}
            onExportData={onExportData}
            onResetData={onResetData}
            subscriptionInfo={subscriptionInfo}
            subscriptionLoading={subscriptionLoading}
          />
        )}
      </main>

      {/* 3. Dedicated Fixed Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenNewSubscriberModal={onOpenNewSubscriberModal}
        totalSubscribersCount={subscribers.length}
      />
    </div>
  );
};

import { useCashboxBalance } from '../../lib/useCashboxBalance';
import React from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileDashboard } from './MobileDashboard';
import { MobileSubscribers } from './MobileSubscribers';
import { MobileMonthlyReports } from './MobileMonthlyReports';
import { MobileMonitor } from './MobileMonitor';
import { MobileSettings } from './MobileSettings';
import { MobileBottomNav } from '../MobileBottomNav';
import { WalletView } from '../WalletView';
import {
  Subscriber,
  SubscriptionTierPricing,
  GeneratorSpecs,
  LineDistribution,
  SettingsFolderItem,
  DeviceViewMode,
  MonthlyTariffRecord,
  Collector,
  AuditLogEntry,
} from '../../types';
import { SubscriptionInfo } from '../SubscriptionStatusUI';
import { reconciledCashbox, summarizeSubscribers } from '../../utils/authoritativeAccounting';
import type { SecureResetResult } from '../SecureSystemReset';

interface MobileLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  monthlyTariffs?: MonthlyTariffRecord[];
  activeMonthId?: string;
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
  collectors?: Collector[];
  auditLogs?: AuditLogEntry[];
  walletResetTimestamp?: string;
  onClearWalletLogs?: () => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  activeTab,
  onTabChange,
  subscribers,
  pricingTiers,
  monthlyTariffs = [],
  activeMonthId,
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
  collectors = [],
  auditLogs = [],
  walletResetTimestamp,
  onClearWalletLogs,
  reportResetMarkers,
  onResetReportYear,
  isOwner,
  onSecureReset,
}) => {
  // WORKMODE_MOBILELAYOUT_THEME_FALLBACK
  const __moldatkTheme = (() => { try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; } })();
  const __setMoldatkTheme = (theme: string) => { try { localStorage.setItem('moldatk_mobile_theme', theme); document.documentElement.setAttribute('data-moldatk-theme', theme); } catch (e) {} };
  // MOBILE_CASHBOX_SINGLE_SOURCE_V3
  const mobileCashboxSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const mobileCashboxAmount = useCashboxBalance(reconciledCashbox(
    mobileCashboxSummary.collected,
    auditLogs,
    walletResetTimestamp,
    activeMonthId,
  ));

  return (
    <div data-moldatk-theme={__moldatkTheme} className="moldatk-mobile-shell min-h-screen bg-[#F7F9FC] dark:bg-[#081521] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-[#F2B544] selection:text-[#0B1F3B] pb-16">
      <MobileHeader
        generatorSpecs={generatorSpecs}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onOpenPricingModal={onOpenPricingModal}
        showSyncStatus={activeTab === 'dashboard'}
      />

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
            activeMonthId={activeMonthId}
            cashboxAmount={mobileCashboxAmount}
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

        {activeTab === 'reports' && (
          <MobileMonthlyReports
            subscribers={subscribers}
            currency={generatorSpecs.currency || 'د.ع'}
            monthlyTariffs={monthlyTariffs}
          />
        )}

        {activeTab === 'wallet' && (
          <div className="p-3.5 pb-24">
            <WalletView
              subscribers={subscribers}
              pricingTiers={pricingTiers}
              activeMonthId={activeMonthId}
              collectors={collectors}
              auditLogs={auditLogs}
              walletResetTimestamp={walletResetTimestamp}
              currency={generatorSpecs.currency}
              onBack={() => onTabChange('dashboard')}
              onClearWalletLogs={onClearWalletLogs}
            />
          </div>
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
            isOwner={isOwner}
            onSecureReset={onSecureReset}
          />
        )}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenNewSubscriberModal={onOpenNewSubscriberModal}
        totalSubscribersCount={subscribers.length}
      />
    </div>
  );
};

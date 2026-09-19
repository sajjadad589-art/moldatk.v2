export type DeviceViewMode = 'auto' | 'mobile' | 'desktop';

export type SubscriptionTierType = 'normal' | 'commercial' | 'golden' | 'free' | 'custom';

export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'free';

export interface SubscriptionTierPricing {
  id: string;
  nameAr: string;
  nameEn: string;
  type: SubscriptionTierType;
  pricePerAmpere: number; // in IQD or local currency
  fixedFee: number;
  description: string;
  badgeColor: string;
  is24Hours: boolean;
  priorityLevel: number;
  freeReason?: string;
  activeSubscribersCount?: number;
}

export interface MonthlyTariffRecord {
  id: string; // canonical YYYY-MM, e.g. "2026-08"
  month: number; // 1-12
  year: number; // 2026
  monthNameAr: string; // e.g. "شهر 8 (آب 2026)"
  tiers: SubscriptionTierPricing[];
  fuelPricePerLiter?: number;
  operatingHoursTotal?: number;
  createdAt: string;
  updatedAt?: string;
  isCurrentActive?: boolean;
}

export interface PaymentAllocationEntry {
  monthId: string;
  monthNameAr: string;
  amount: number;
}

export interface SubscriberInvoice {
  id: string; // e.g. "INV-2026-08-101"
  subscriberId: string;
  monthId: string; // e.g. "2026-08"
  monthNameAr: string; // e.g. "شهر 8 (آب 2026)"
  issueDate: string; // YYYY-MM-DD
  paymentDate?: string;
  amperes: number;
  /** Physical/original subscribed amperes at invoice issue time. */
  originalAmperes?: number;
  /** Recurring ampere discount snapshot for this invoice. */
  discountedAmperes?: number;
  /** Financial amperes actually billed after discount. */
  billedAmperes?: number;
  /** Invoice value before the ampere discount. */
  grossAmountBeforeDiscount?: number;
  /** Financial value removed by the recurring ampere discount. */
  discountAmount?: number;
  tier: SubscriptionTierType;
  pricePerAmpere: number;
  fixedFee: number;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingAfterPayment?: number;
  status: 'paid' | 'partial' | 'unpaid' | 'cancelled' | 'free';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  collectorName?: string;
  notes?: string;
  receiptNumber?: string;

  // Receipt/payment snapshot. These fields are optional so old cloud rows remain compatible.
  previousDebtBefore?: number;
  currentCharge?: number;
  totalBeforePayment?: number;
  appliedToPreviousDebt?: number;
  appliedToCurrentMonth?: number;
  totalOutstandingAfter?: number;
  paymentAllocations?: PaymentAllocationEntry[];
}

export interface Subscriber {
  id: string;
  code: string; // e.g. "MW-104"
  fullName: string;
  phone: string;
  tier: SubscriptionTierType;
  amperes: number;
  /** Recurring monthly discount in amperes. Physical load remains unchanged. */
  ampereDiscount?: number;
  /** Optional owner note explaining the recurring ampere discount. */
  ampereDiscountReason?: string;
  lineId?: string;
  lineName?: string;
  /** Legacy alias used by existing UI; kept synchronized with lineName. */
  line?: string;
  /** Legacy alias used by some receipt screens. */
  subscriberCode?: string;
  address?: string;
  boxNumber?: string; // رقم الجوزة / الصندوق
  paymentStatus: PaymentStatus;
  lastPaymentDate?: string;
  /** Total outstanding balance across all monthly invoices. */
  amountDue: number;
  /** Amount paid toward the active/current month (legacy-compatible summary field). */
  amountPaid: number;
  notes?: string;
  isExempted?: boolean;
  exemptReason?: string;
  invoicesHistory?: SubscriberInvoice[];
  createdAt?: string;
  joiningDate?: string;
}

export type AuditLogCategory = 'payment' | 'cancellation' | 'subscriber' | 'update' | 'pricing' | 'generator' | 'system';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO date string
  category: AuditLogCategory;
  title: string;
  details: string;
  entityId?: string; // subscriber ID, invoice ID, or setting key
  entityName?: string;
  actorName: string; // e.g. "مدير النظام" or Collector name
  previousValue?: string;
  newValue?: string;
  cancellationReason?: string;
  amount?: number;
}

export type PhaseType = '3-phase' | 'phase-R' | 'phase-S' | 'phase-T' | 'single-phase';

export interface LineDistribution {
  id: string;
  name: string;
  zone: string;
  phaseType?: PhaseType;
  phaseNameAr?: string;
  maxCapacityAmperes: number;
  currentLoadAmperes: number;
  subscribersCount: number;
  technicianName: string;
  breakerNumber?: string;
}

export interface CollectorPermissions {
  canCollectPayments: boolean;       // تسديد وقبض اشتراكات المشتركين
  canCancelPayments: boolean;        // إلغاء التسديد وتوثيق السبب
  canAddSubscribers: boolean;        // إضافة مشتركين جدد
  canEditSubscribers: boolean;       // تعديل بيانات المشتركين
  canDeleteSubscribers: boolean;     // حذف المشتركين
  canApplyFreeExemption: boolean;    // منح إعفاء مجاني
  canPrintReceipts: boolean;         // طباعة ومشاركة وصولات القبض
  canViewFinancialReports: boolean;  // عرض التقارير المالية والإيرادات
  canAccessSystemSettings: boolean;  // الوصول لإعدادات المنظومة والمولد
}

export interface Collector {
  id: string;
  name: string;
  phone: string;
  passcode: string; // الرمز السري للحساب (لربطه بتسجيل الدخول لاحقاً)
  permissions?: CollectorPermissions; // صلاحيات الجابي (العرض والتعديل)
  assignedLineId?: string;
  assignedLineName?: string;
  assignedLineIds?: string[];
  assignedAllLines?: boolean;
  role?: 'collector';
  nationalId?: string;
  notes?: string;
  isActive?: boolean;
  generatorId?: string | null;
}

export type UserRole = 'super_admin' | 'super_admin_manager' | 'generator_admin' | 'admin' | 'collector';

export interface ActiveUserSession {
  role: UserRole;
  collectorId?: string;
  collectorName?: string;
  collectorPermissions?: CollectorPermissions;
  assignedLineId?: string;
  assignedLineName?: string;
  assignedLineIds?: string[];
  assignedAllLines?: boolean;
  username?: string;
  loginTime?: string;
  email?: string;
  generatorId?: string | null;
}

export interface GeneratorSpecs {
  generatorName: string;
  engineBrand?: string;
  ownerName: string;
  location: string;
  kvaRating: number; // e.g. 500 KVA
  engineHorsePower?: number; // e.g. 620 HP
  phaseCount?: number; // 3
  maxAmperes: number; // e.g. 720 Amps
  currentAmperes: number;
  voltage: number; // e.g. 228 V
  frequency: number; // 50 Hz
  dieselTankCapacityLiters: number;
  currentDieselLiters: number;
  hourlyFuelConsumptionLiters: number;
  oilChangeRemainingHours: number;
  oilChangeIntervalHours?: number;
  totalRunHours: number;
  status: 'running' | 'idle' | 'maintenance' | 'warning';
  currency: string; // e.g. "د.ع"
  fuelPricePerLiter?: number;
}

export interface InvoiceTemplateSettings {
  headerTitle: string;
  subTitle: string;
  ownerPhone: string;
  locationAddress: string;
  footerNotes: string;
  paperSize: 'thermal' | 'thermal_58' | 'thermal_80' | 'a5' | 'a4';

  // Receipt visibility. These switches are authoritative for preview, browser print and SUNMI print.
  showLogo: boolean;
  showSystemBrand: boolean;
  showGeneratorName: boolean;
  showSubTitle: boolean;
  showDate: boolean;
  showReceiptNumber: boolean;
  showSubscriberName: boolean;
  showPhone: boolean;
  showLineName: boolean;
  showAmperes: boolean;
  showPricePerAmp: boolean;
  showPaymentMonth: boolean;
  showPaymentStatus: boolean;
  showCollectorName: boolean;
  showPreviousDebt: boolean;
  showCurrentCharge: boolean;
  showTotalBeforePayment: boolean;
  showAppliedToCurrentMonth: boolean;
  showRemainingAfterPayment: boolean;
  showReceivedAmount: boolean;
  showThankYou: boolean;
  showQr: boolean;
  showFooterNotes: boolean;
  showFooterSystemText: boolean;

  // Customizable labels/text rendered on the receipt.
  systemBrandText: string;
  dateLabel: string;
  receiptNumberLabel: string;
  subscriberNameLabel: string;
  phoneLabel: string;
  lineNameLabel: string;
  amperesLabel: string;
  pricePerAmpLabel: string;
  paymentMonthLabel: string;
  paymentStatusLabel: string;
  collectorNameLabel: string;
  previousDebtLabel: string;
  currentChargeLabel: string;
  totalBeforePaymentLabel: string;
  appliedToCurrentMonthLabel: string;
  remainingAfterPaymentLabel: string;
  receivedAmountLabel: string;
  thankYouText: string;
  qrCaption: string;
  footerSystemText: string;
}

export interface SettingsFolderItem {
  id: string;
  folderKey: string;
  titleAr: string;
  descriptionAr: string;
  iconName: string;
  itemCount: number;
  badge?: string;
  category: 'financial' | 'technical' | 'administrative' | 'system';
  updatedAt: string;
}

export interface FuelLogEntry {
  id: string;
  date: string;
  litersAdded: number;
  cost: number;
  supplier: string;
  invoiceNumber: string;
}

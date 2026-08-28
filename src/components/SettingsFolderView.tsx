import React, { useState, useEffect } from 'react';
import {
  Folder,
  Layers,
  Printer,
  Users,
  Database,
  Search,
  Monitor,
  Zap,
  Activity,
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  GripVertical,
  Clock,
  ShieldCheck,
  Phone,
  Key,
  LogOut,
  Smartphone,
  Cpu,
  Bell,
} from 'lucide-react';
import { SubscriptionTierPricing, GeneratorSpecs, LineDistribution, DeviceViewMode, AuditLogEntry, Collector } from '../types';
import { formatCurrency } from '../utils/formatters';
import { SubscriptionInfoButton, SubscriptionInfo } from './SubscriptionStatusUI';

interface SettingsFolderViewProps {
  folders: any[];
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  auditLogs?: AuditLogEntry[];
  collectors?: Collector[];
  onOpenPricingModal: () => void;
  onOpenFolderModal: (folderKey: string) => void;
  onExportData: () => void;
  onResetData: () => void;
  viewMode: DeviceViewMode;
  onChangeViewMode: (mode: DeviceViewMode) => void;
  onUpdateLines?: (newLines: LineDistribution[]) => void;
  onUpdateCollectors?: (newCollectors: Collector[]) => void;
  subscriptionInfo?: SubscriptionInfo | null;
  subscriptionLoading?: boolean;
}

export const SettingsFolderView: React.FC<SettingsFolderViewProps> = ({
  pricingTiers,
  generatorSpecs,
  lines,
  auditLogs = [],
  collectors = [],
  onOpenPricingModal,
  onOpenFolderModal,
  viewMode,
  onChangeViewMode,
  onUpdateLines,
  onUpdateCollectors,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isCollectorsModalOpen, setIsCollectorsModalOpen] = useState(false);
  const [isAddCollectorModalOpen, setIsAddCollectorModalOpen] = useState(false);
  
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);

  const [collectorName, setCollectorName] = useState('');
  const [collectorPhone, setCollectorPhone] = useState('');
  const [collectorPasscode, setCollectorPasscode] = useState('');

  const [collectorsList, setCollectorsList] = useState<Collector[]>(() =>
    collectors && collectors.length > 0 ? collectors : []
  );

  const [linesData, setLinesData] = useState<LineDistribution[]>(() =>
    lines && lines.length > 0 ? lines : []
  );

  const [textInputVal, setTextInputVal] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTextVal, setEditTextVal] = useState('');
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState(() => {
    const saved = localStorage.getItem('moldatk_invoice_custom_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      printerType: 'thermal_80',
      headerTitle: 'مولدة المحاربين',
      footerNote: 'شكراً لتسديدكم في الموعد المحدد، يرجى الاحتفاظ بالوصل.',
      showPhaseName: true,
      showGeneratorName: true,
      showTotalAmount: true,
      showDueDebt: true,
      showAmperesCount: true,
      showAmperesPrice: true,
      showPaymentMonth: true,
      showCollectorName: true,
      showBarcode: true,
      customNoteText: '',
      showPhoneOnReceipt: true,
      showAddressOnReceipt: false,
    };
  });

  useEffect(() => {
    setCollectorsList(collectors || []);
  }, [collectors]);

  useEffect(() => {
    setLinesData(lines || []);
  }, [lines]);

  const handleLogout = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج من الحساب؟')) {
      localStorage.removeItem('moldatk_session');
      window.location.reload();
    }
  };

  const categories = [
    { id: 'all', name: 'كافة المجلدات' },
    { id: 'financial', name: 'المالية والتسعيرة' },
    { id: 'generator', name: 'المولد والشبكة' },
    { id: 'management', name: 'الإدارة والطباعة' },
    { id: 'backup', name: 'النسخ والبيانات' },
  ];

  const handleSaveInvoiceSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('moldatk_invoice_custom_settings', JSON.stringify(invoiceSettings));
    setIsInvoiceModalOpen(false);
    alert('تم حفظ إعدادات الفواتير والطباعة بنجاح!');
  };

  const handleOpenAddCollector = () => {
    setEditingCollector(null);
    setCollectorName('');
    setCollectorPhone('');
    setCollectorPasscode('');
    setIsAddCollectorModalOpen(true);
  };

  const handleOpenEditCollector = (c: Collector) => {
    setEditingCollector(c);
    setCollectorName(c.name);
    setCollectorPhone(c.phone);
    setCollectorPasscode(c.passcode || '');
    setIsAddCollectorModalOpen(true);
  };

  const handleSaveCollectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectorName.trim() || !collectorPhone.trim()) {
      alert('يرجى إدخال اسم الجابي ورقم الهاتف (اليوزر)');
      return;
    }

    let updated: Collector[];
    if (editingCollector) {
      updated = collectorsList.map(c => c.id === editingCollector.id ? {
        ...c,
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        passcode: collectorPasscode.trim() || '1234',
      } : c);
      alert('تم تحديث بيانات وحساب الجابي بنجاح!');
    } else {
      const newCollectorObj: Collector = {
        id: `col-${Date.now()}`,
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        passcode: collectorPasscode.trim() || '1234',
        role: 'collector',
      };
      updated = [...collectorsList, newCollectorObj];
      alert('تم إضافة حساب الجابي بنجاح!');
    }

    setCollectorsList(updated);
    if (onUpdateCollectors) {
      onUpdateCollectors(updated);
    }
    setIsAddCollectorModalOpen(false);
  };

  const handleDeleteCollector = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف حساب هذا الجابي؟')) return;
    const updated = collectorsList.filter(c => c.id !== id);
    setCollectorsList(updated);
    if (onUpdateCollectors) {
      onUpdateCollectors(updated);
    }
  };

  const addLineFromInput = () => {
    if (!textInputVal || !textInputVal.trim()) return;

    const newName = textInputVal.trim();
    const newList = [
      ...linesData,
      { id: `line-${Date.now()}`, name: newName, loadAmps: 0, subscribersCount: 0 }
    ];

    setLinesData(newList);
    setTextInputVal('');
    if (onUpdateLines) {
      onUpdateLines(newList);
    }
  };

  const handleFormSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addLineFromInput();
  };

  const handleItemDelete = (id: string) => {
    const newList = linesData.filter(l => l.id !== id);
    setLinesData(newList);
    if (onUpdateLines) {
      onUpdateLines(newList);
    }
  };

  const handleItemSaveEdit = (id: string) => {
    if (!editTextVal || !editTextVal.trim()) return;
    const newList = linesData.map(l => l.id === id ? { ...l, name: editTextVal.trim() } : l);
    setLinesData(newList);
    setEditId(null);
    setEditTextVal('');
    if (onUpdateLines) {
      onUpdateLines(newList);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;

    const updatedList = [...linesData];
    const [movedItem] = updatedList.splice(draggedItemIndex, 1);
    updatedList.splice(targetIndex, 0, movedItem);

    setDraggedItemIndex(null);
    setLinesData(updatedList);
    if (onUpdateLines) {
      onUpdateLines(updatedList);
    }
  };

  const getPrinterTypeName = (type: string) => {
    if (type === 'thermal_58') return 'حراري 58 مم';
    if (type === 'thermal_80') return 'حراري 80 مم';
    return 'صفحة A5';
  };

  return (
    <div className="space-y-6 font-['Cairo'] pb-20" dir="rtl">
      
      {/* رأس لوحة الإعدادات */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#131E38] p-6 rounded-3xl border border-slate-200 dark:border-blue-900/50 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-500">
            <span>نظام مولدتك</span>
            <span>/</span>
            <span>دليل إعدادات المنظومة</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">فروع وإعدادات المنظومة</h1>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('moldatk-open-notifications'))}
          className="flex items-center justify-center gap-2 w-14 h-14 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 transition-all shadow-sm cursor-pointer"
          title="إشعارات الإدارة"
        >
          <Bell className="w-5 h-5" />
        </button>
      </div>

      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />

      {/* صندوق التحكم بالمنظور (حاسوب، هاتف، تلقائي) وزر تسجيل الخروج داخل صفحة الإعدادات */}
      <div className="bg-white dark:bg-[#131E38] p-5 rounded-3xl border border-slate-200 dark:border-blue-900/50 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">إعدادات المنظور والحساب</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">طريقة وعرض المنظور:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeViewMode('mobile')}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  viewMode === 'mobile'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>هاتف</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeViewMode('desktop')}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  viewMode === 'desktop'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>حاسوب</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeViewMode('auto')}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  viewMode === 'auto'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>تلقائي</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 flex flex-col justify-end">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">إدارة الجلسة:</span>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج من المنظومة</span>
            </button>
          </div>

        </div>
      </div>

      {/* شريط البحث والتصنيفات */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 ml-2">التصنيف:</span>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white dark:bg-[#131E38] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-blue-900/50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث في المجلدات والإعدادات..."
            className="w-full bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 rounded-2xl pr-11 pl-4 py-3 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* شبكة الإعدادات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* قائمة الأسعار */}
        <div
          onClick={onOpenPricingModal}
          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all">
              <DollarSignIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              موصى به
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              تسعيرة الأمبير
            </h3>
            <p className="text-xs text-slate-400 font-medium">ضبط سعر الأمبير الشهري وحفظ الإعدادات</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">
            <span>فتح الإعدادات</span>
            <Folder className="w-4 h-4" />
          </div>
        </div>

        {/* بطاقة الكابينات والبوردات */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="bg-white dark:bg-[#131E38] border border-blue-500/80 hover:border-blue-500 rounded-3xl p-5 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-600 text-white transition-all shadow-md shadow-blue-600/30">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-blue-500/10 text-blue-400 border-blue-500/30">
              نشط
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              الكابينات / البوردات
            </h3>
            <p className="text-xs text-slate-400 font-medium">{linesData.length} كابينات وبوردات مسجلة</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">
            <span>إدارة الكابينات والبوردات</span>
            <Folder className="w-4 h-4" />
          </div>
        </div>

        {/* إعدادات الفواتير والطباعة */}
        <div
          onClick={() => setIsInvoiceModalOpen(true)}
          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all">
              <Printer className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
              {getPrinterTypeName(invoiceSettings.printerType)}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              إعدادات الفواتير والطباعة الإيصالات
            </h3>
            <p className="text-xs text-slate-400 font-medium">وصل 58مم / 80مم + A5</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">
            <span>فتح الإعدادات</span>
            <Folder className="w-4 h-4" />
          </div>
        </div>

        {/* سجل الحركات والتدقيق المالي (Audit Logs) */}
        <div
          onClick={() => setIsAuditModalOpen(true)}
          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-amber-500/10 text-amber-400 border-amber-500/30">
              مراقب ({auditLogs.length})
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              سجل الحركات والتدقيق المالي (Audit Logs)
            </h3>
            <p className="text-xs text-slate-400 font-medium">تسجيل حي مباشر لكافة العمليات</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">
            <span>فتح السجل</span>
            <Folder className="w-4 h-4" />
          </div>
        </div>

        {/* بيانات المولد (قريباً) */}
        <div
          onClick={() => alert('هذه الخاصية قيد التطوير وستتوفر قريباً!')}
          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group opacity-90"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-amber-500/10 text-amber-400 border-amber-500/30">
              قريباً...
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              بيانات المولد وقدرة المحولة (KVA)
            </h3>
            <p className="text-xs text-slate-400 font-medium">قيد التطوير والتحديث</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-slate-400">
            <span>ستتوفر قريباً</span>
            <Folder className="w-4 h-4 opacity-50" />
          </div>
        </div>

        {/* الجباة والمحصلون */}
        <div
          onClick={() => setIsCollectorsModalOpen(true)}
          className="bg-white dark:bg-[#131E38] border border-slate-200 dark:border-blue-900/50 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-teal-500/10 text-teal-400 border-teal-500/30">
              نشط ({collectorsList.length})
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              الجباة والمحصلون الحسابات واليوزرات
            </h3>
            <p className="text-xs text-slate-400 font-medium">إدارة يوزرات ورموز الدخول لتطبيق الجباة</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-blue-950/50 flex items-center justify-between text-xs font-bold text-blue-500">
            <span>فتح الإعدادات</span>
            <Folder className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* نافذة إدارة الجباة وحساباتهم */}
      {isCollectorsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-teal-400" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">إدارة حسابات الجباة لتطبيق الميدان</h3>
                  <p className="text-xs text-slate-400">تخصيص أسماء، يوزرات، ورموز الدخول الخاصة بجهاز الـ POS والتطبيق الخارجي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectorsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">قائمة حسابات الجباة ({collectorsList.length})</h4>
                <button
                  type="button"
                  onClick={handleOpenAddCollector}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة حساب جابي جديد</span>
                </button>
              </div>

              {collectorsList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Users className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-slate-500">لا توجد حسابات جباة مسجلة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto">
                  {collectorsList.map(c => (
                    <div key={c.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <Phone className="w-3.5 h-3.5" />
                            يوزر الدخول: {c.phone}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <Key className="w-3.5 h-3.5" />
                            الرمز السري: {c.passcode || '1234'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCollector(c)}
                          className="px-3 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600 hover:text-white text-blue-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCollector(c.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 transition-all cursor-pointer"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCollectorsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-md"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* نافذة إضافة أو تعديل معلومات جابي (بدون صلاحيات وبدون خط) */}
      {isAddCollectorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-md space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingCollector ? 'تعديل بيانات حساب الجابي' : 'إضافة حساب جابي جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCollectorModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCollectorSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الجابي / المحاسب</label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={e => setCollectorName(e.target.value)}
                  placeholder="مثال: أحمد الجابي"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم الهاتف (يوزر الدخول)</label>
                  <input
                    type="text"
                    value={collectorPhone}
                    onChange={e => setCollectorPhone(e.target.value)}
                    placeholder="07700000000"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الرمز السري لجهاز الـ POS</label>
                  <input
                    type="text"
                    value={collectorPasscode}
                    onChange={e => setCollectorPasscode(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCollectorModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-md"
                >
                  {editingCollector ? 'حفظ التعديلات' : 'حفظ وإضافة الحساب'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* نافذة عرض سجل الحركات والتدقيق المالي (Audit Logs Modal) */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">سجل الحركات والتدقيق المالي</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400">إجمالي الحركات المسجلة ({auditLogs.length})</h4>
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Activity className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-40" />
                  <p className="text-xs font-bold text-slate-500">لا توجد حركات مسجلة حتى الآن.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            log.category === 'payment' ? 'bg-emerald-500/10 text-emerald-500' :
                            log.category === 'cancellation' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {log.title}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white">{log.entityName}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{log.details}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleString('ar-IQ')}
                          </span>
                          <span>المسؤول: {log.actorName}</span>
                        </div>
                      </div>

                      {log.amount !== undefined && log.amount > 0 && (
                        <div className="text-left shrink-0">
                          <span className="text-xs font-black text-emerald-500 tabular-nums font-mono" dir="ltr">
                            +{formatCurrency(log.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-md"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* نافذة تخصيص إعدادات الفواتير والطباعة */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">تخصيص إعدادات الفواتير والطباعة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceSettings} className="space-y-5">
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع وصل الطباعة الافتراضي</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceSettings({ ...invoiceSettings, printerType: 'thermal_58' })}
                    className={`p-3 rounded-2xl border text-[11px] font-black transition-all cursor-pointer ${
                      invoiceSettings.printerType === 'thermal_58'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    حراري 58 مم
                  </button>

                  <button
                    type="button"
                    onClick={() => setInvoiceSettings({ ...invoiceSettings, printerType: 'thermal_80' })}
                    className={`p-3 rounded-2xl border text-[11px] font-black transition-all cursor-pointer ${
                      invoiceSettings.printerType === 'thermal_80'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    حراري 80 مم
                  </button>

                  <button
                    type="button"
                    onClick={() => setInvoiceSettings({ ...invoiceSettings, printerType: 'a5' })}
                    className={`p-3 rounded-2xl border text-[11px] font-black transition-all cursor-pointer ${
                      invoiceSettings.printerType === 'a5'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    صفحة A5
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">عنوان رأس الوصل (اسم المنظومة / المولد)</label>
                <input
                  type="text"
                  value={invoiceSettings.headerTitle}
                  onChange={e => setInvoiceSettings({ ...invoiceSettings, headerTitle: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                  التحكم في ظهور حقول وقوائم الوصل:
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showPhaseName}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showPhaseName: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة اسم الفيز</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showGeneratorName}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showGeneratorName: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة اسم المولدة</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showTotalAmount}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showTotalAmount: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة المبلغ الكلي</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showDueDebt}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showDueDebt: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة الديون المستحقة</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showAmperesCount}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showAmperesCount: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة عدد الامبيرات</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showAmperesPrice}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showAmperesPrice: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة سعر الامبير</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showPaymentMonth}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showPaymentMonth: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة شهر التسديد</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showCollectorName}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showCollectorName: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة اسم المحاسب</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={invoiceSettings.showBarcode}
                      onChange={e => setInvoiceSettings({ ...invoiceSettings, showBarcode: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إظهار الباركود</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كتابة ملاحظة (تظهر أسفل الوصل)</label>
                <textarea
                  rows={3}
                  value={invoiceSettings.customNoteText !== undefined ? invoiceSettings.customNoteText : invoiceSettings.footerNote}
                  onChange={e => setInvoiceSettings({ ...invoiceSettings, customNoteText: e.target.value, footerNote: e.target.value })}
                  placeholder="اكتب هنا أي نص ترغب بظهوره أسفل الإيصال..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-md"
                >
                  حفظ الإعدادات
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* نافذة إدارة الكابينات والبوردات المنبثقة */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-['Cairo']" dir="rtl">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">إدارة الكابينات / البوردات</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmitAdd} className="flex items-center gap-2">
              <button
                type="button"
                onClick={addLineFromInput}
                className="flex items-center gap-1.5 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-blue-600/25 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>

              <input
                type="text"
                value={textInputVal}
                onChange={e => setTextInputVal(e.target.value)}
                placeholder="أدخل اسم الكابينة أو البورد الجديد..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400">
                الكابينات والبوردات الحالية ({linesData.length}) - (اسحب وأفلت لإعادة الترتيب)
              </h4>
              {linesData.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">لا توجد كابينات مسجلة حالياً.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {linesData.map((line, index) => (
                    <div
                      key={line.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all cursor-grab active:cursor-grabbing hover:border-blue-500/50 ${
                        draggedItemIndex === index ? 'opacity-40 scale-95 border-dashed border-blue-500' : 'opacity-100'
                      }`}
                    >
                      {editId === line.id ? (
                        <div className="flex items-center gap-2 flex-1 ml-3">
                          <button
                            type="button"
                            onClick={() => handleItemSaveEdit(line.id)}
                            className="p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            value={editTextVal}
                            onChange={e => setEditTextVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleItemSaveEdit(line.id);
                              }
                            }}
                            className="flex-1 bg-white dark:bg-slate-800 border border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-xs font-black text-slate-900 dark:text-white select-none">{line.name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {editId !== line.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(line.id);
                              setEditTextVal(line.name);
                            }}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/20 hover:text-blue-500 text-slate-400 transition-all cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleItemDelete(line.id)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 transition-all cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-md"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

function DollarSignIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Zap,
  Network,
  Users,
  Printer,
  Database,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Upload,
  Download,
  Phone,
  Layers,
  ShieldCheck,
  Shield,
  Sliders,
  AlertTriangle,
  Info,
  History,
  FileX2,
  CheckCircle,
  Calendar,
  Search,
  Filter,
  DollarSign,
  UserCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import {
  GeneratorSpecs,
  LineDistribution,
  Collector,
  CollectorPermissions,
  InvoiceTemplateSettings,
  SettingsFolderItem,
  PhaseType,
  AuditLogEntry,
} from '../types';
import { formatCurrency, formatNumberArabic } from '../utils/formatters';

interface FolderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderKey: string | null;
  folders: SettingsFolderItem[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  collectors: Collector[];
  invoiceTemplate: InvoiceTemplateSettings;
  auditLogs?: AuditLogEntry[];
  onUpdateGeneratorSpecs: (specs: GeneratorSpecs) => void;
  onUpdateLines: (lines: LineDistribution[]) => void;
  onUpdateCollectors: (collectors: Collector[]) => void;
  onUpdateInvoiceTemplate: (template: InvoiceTemplateSettings) => void;
  onClearAuditLogs?: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonData: any) => void;
  onResetFactoryData: () => void;
}

export const FolderDetailModal: React.FC<FolderDetailModalProps> = ({
  isOpen,
  onClose,
  folderKey,
  folders,
  generatorSpecs,
  lines,
  collectors,
  invoiceTemplate,
  auditLogs = [],
  onUpdateGeneratorSpecs,
  onUpdateLines,
  onUpdateCollectors,
  onUpdateInvoiceTemplate,
  onClearAuditLogs,
  onExportBackup,
  onImportBackup,
  onResetFactoryData,
}) => {
  const [specs, setSpecs] = useState<GeneratorSpecs>(generatorSpecs);
  const [currentLines, setCurrentLines] = useState<LineDistribution[]>(lines);
  const [currentCollectors, setCurrentCollectors] = useState<Collector[]>(collectors);
  const [currentTemplate, setCurrentTemplate] = useState<InvoiceTemplateSettings>(invoiceTemplate);
  const [saved, setSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [showPasscodes, setShowPasscodes] = useState<Record<string, boolean>>({});
  const [expandedPermissions, setExpandedPermissions] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSpecs(generatorSpecs);
      setCurrentLines(lines);
      setCurrentCollectors(collectors);
      setCurrentTemplate(invoiceTemplate);
      setSaved(false);
      setResetConfirm(false);
      setAuditFilter('all');
      setAuditSearch('');
    }
  }, [isOpen, generatorSpecs, lines, collectors, invoiceTemplate]);

  if (!isOpen || !folderKey) return null;

  const currentFolder = folders.find(f => f.folderKey === folderKey);

  // --- Line Handlers ---
  const handleAddLine = () => {
    const newLineId = `line-${Date.now()}`;
    const phaseTypes: PhaseType[] = ['phase-R', 'phase-S', 'phase-T', '3-phase'];
    const assignedPhase = phaseTypes[currentLines.length % phaseTypes.length];
    const phaseNames: Record<PhaseType, string> = {
      'phase-R': 'فيز R (الأحمر) - 380V',
      'phase-S': 'فيز S (الأصفر) - 380V',
      'phase-T': 'فيز T (الأزرق) - 380V',
      '3-phase': 'ثلاثي الفيز (3-Phase)',
      'single-phase': 'فيز أحادي (220V)',
    };

    const newLine: LineDistribution = {
      id: newLineId,
      name: `خط تغذية جديد (${currentLines.length + 1})`,
      zone: 'المنطقة / الشارع',
      phaseType: assignedPhase,
      phaseNameAr: phaseNames[assignedPhase],
      maxCapacityAmperes: 200,
      currentLoadAmperes: 0,
      subscribersCount: 0,
      technicianName: 'فني الصيانة المناوب',
      breakerNumber: `Q${currentLines.length + 1}-250A`,
    };

    setCurrentLines([...currentLines, newLine]);
  };

  const handleDeleteLine = (id: string) => {
    if (currentLines.length <= 1) return;
    setCurrentLines(currentLines.filter(l => l.id !== id));
  };

  const handleUpdateLine = (id: string, updates: Partial<LineDistribution>) => {
    setCurrentLines(prev =>
      prev.map(l => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // --- Collector Handlers ---
  const handleAddCollector = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const newCollector: Collector = {
      id: `col-${Date.now()}`,
      name: 'محصل ميداني جديد',
      phone: '07700000000',
      passcode: randomPin,
      permissions: {
        canCollectPayments: true,
        canCancelPayments: false,
        canAddSubscribers: false,
        canEditSubscribers: false,
        canDeleteSubscribers: false,
        canApplyFreeExemption: false,
        canPrintReceipts: true,
        canViewFinancialReports: false,
        canAccessSystemSettings: false,
      },
      assignedLineId: currentLines[0]?.id || 'line-1',
      assignedLineName: currentLines[0]?.name || 'الخط الرئيسي',
      nationalId: '',
      notes: 'جابي معتمد',
      isActive: true,
    };
    setCurrentCollectors([...currentCollectors, newCollector]);
  };

  const handleDeleteCollector = (id: string) => {
    setCurrentCollectors(currentCollectors.filter(c => c.id !== id));
  };

  const handleUpdateCollector = (id: string, updates: Partial<Collector>) => {
    setCurrentCollectors(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleUpdateCollectorPermission = (
    collectorId: string,
    permissionKey: keyof CollectorPermissions,
    value: boolean
  ) => {
    setCurrentCollectors(prev =>
      prev.map(c => {
        if (c.id !== collectorId) return c;
        const currentPerms = c.permissions || {
          canCollectPayments: true,
          canCancelPayments: false,
          canAddSubscribers: false,
          canEditSubscribers: false,
          canDeleteSubscribers: false,
          canApplyFreeExemption: false,
          canPrintReceipts: true,
          canViewFinancialReports: false,
          canAccessSystemSettings: false,
        };
        return {
          ...c,
          permissions: {
            ...currentPerms,
            [permissionKey]: value,
          },
        };
      })
    );
  };

  const handleApplyPermissionPreset = (
    collectorId: string,
    preset: 'standard' | 'supervisor' | 'restricted'
  ) => {
    setCurrentCollectors(prev =>
      prev.map(c => {
        if (c.id !== collectorId) return c;
        let newPerms: CollectorPermissions;
        if (preset === 'supervisor') {
          newPerms = {
            canCollectPayments: true,
            canCancelPayments: true,
            canAddSubscribers: true,
            canEditSubscribers: true,
            canDeleteSubscribers: false,
            canApplyFreeExemption: true,
            canPrintReceipts: true,
            canViewFinancialReports: false,
            canAccessSystemSettings: false,
          };
        } else if (preset === 'restricted') {
          newPerms = {
            canCollectPayments: true,
            canCancelPayments: false,
            canAddSubscribers: false,
            canEditSubscribers: false,
            canDeleteSubscribers: false,
            canApplyFreeExemption: false,
            canPrintReceipts: false,
            canViewFinancialReports: false,
            canAccessSystemSettings: false,
          };
        } else {
          // Standard collector
          newPerms = {
            canCollectPayments: true,
            canCancelPayments: false,
            canAddSubscribers: false,
            canEditSubscribers: false,
            canDeleteSubscribers: false,
            canApplyFreeExemption: false,
            canPrintReceipts: true,
            canViewFinancialReports: false,
            canAccessSystemSettings: false,
          };
        }
        return { ...c, permissions: newPerms };
      })
    );
  };

  const handleGenerateNewPin = (collectorId: string) => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    handleUpdateCollector(collectorId, { passcode: newPin });
  };

  // --- File Import Handler ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportBackup(json);
        onClose();
      } catch (err) {
        alert('الملف المحدد غير صالح كنسخة احتياطية لنظام مولدتك');
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (folderKey === 'generator_specs') {
      onUpdateGeneratorSpecs(specs);
    } else if (folderKey === 'lines_zones') {
      onUpdateLines(currentLines);
    } else if (folderKey === 'collectors') {
      onUpdateCollectors(currentCollectors);
    } else if (folderKey === 'invoices_templates') {
      onUpdateInvoiceTemplate(currentTemplate);
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesCategory = auditFilter === 'all' || log.category === auditFilter;
    const matchesSearch =
      !auditSearch ||
      log.title.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.entityName && log.entityName.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.actorName && log.actorName.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.cancellationReason && log.cancellationReason.toLowerCase().includes(auditSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        id="folder-detail-modal"
        className="relative w-full max-w-3xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              {folderKey === 'audit_logs' && <History className="w-5 h-5 text-amber-500" />}
              {folderKey === 'generator_specs' && <Zap className="w-5 h-5 text-amber-500" />}
              {folderKey === 'lines_zones' && <Network className="w-5 h-5 text-blue-500" />}
              {folderKey === 'collectors' && <Users className="w-5 h-5 text-indigo-500" />}
              {folderKey === 'invoices_templates' && <Printer className="w-5 h-5 text-purple-500" />}
              {folderKey === 'backup_data' && <Database className="w-5 h-5 text-cyan-500" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {currentFolder?.titleAr || 'إعدادات المجلد'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentFolder?.descriptionAr}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Content By Folder Key */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* ================= 0. Audit Logs Archive (سجل الحركات الشامل) ================= */}
          {folderKey === 'audit_logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث في السجل (مشترك، كود، سبب الإلغاء، الجابي)..."
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {onClearAuditLogs && auditLogs.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('هل تريد مسح سجل الحركات؟')) {
                        onClearAuditLogs();
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ السجل</span>
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: `كافة الحركات (${auditLogs.length})` },
                  { id: 'payment', label: `التسديدات (${auditLogs.filter(l => l.category === 'payment').length})` },
                  { id: 'cancellation', label: `الإلغاءات (${auditLogs.filter(l => l.category === 'cancellation').length})` },
                  { id: 'pricing', label: `التسعيرة (${auditLogs.filter(l => l.category === 'pricing').length})` },
                  { id: 'subscriber', label: `المشتركون (${auditLogs.filter(l => l.category === 'subscriber').length})` },
                  { id: 'generator', label: `المولد (${auditLogs.filter(l => l.category === 'generator').length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAuditFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                      auditFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Audit Log Entries List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredAuditLogs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                    لا توجد حركات مسجلة مطابقة لبحثك
                  </div>
                ) : (
                  filteredAuditLogs.map(log => {
                    const isCancellation = log.category === 'cancellation';
                    const isPayment = log.category === 'payment';

                    return (
                      <div
                        key={log.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCancellation
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : isPayment
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 dark:text-white text-xs">
                                {log.title}
                              </span>

                              {isCancellation && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-300 dark:border-rose-800">
                                  <FileX2 className="w-3 h-3 text-rose-500" />
                                  إلغاء إيصال
                                </span>
                              )}

                              {isPayment && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                                  تسديد مالي
                                </span>
                              )}

                              {log.amount !== undefined && (
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                  {formatCurrency(log.amount)}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                              {log.details}
                            </p>

                            {/* Cancellation Reason Alert Box */}
                            {isCancellation && log.cancellationReason && (
                              <div className="mt-2 p-2.5 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-[11px] text-rose-900 dark:text-rose-200 space-y-0.5">
                                <div className="font-bold flex items-center gap-1 text-rose-950 dark:text-rose-200">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>سبب الإلغاء الموثق:</span>
                                </div>
                                <p className="pr-4">{log.cancellationReason}</p>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                              {log.entityName && <span>الطرف: {log.entityName}</span>}
                              {log.actorName && <span>• المنفّذ: {log.actorName}</span>}
                              <span>• التوقيت: {new Date(log.timestamp).toLocaleString('ar-IQ')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= 1. Generator Specs CRUD ================= */}
          {folderKey === 'generator_specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم محطة التوليد / المولد
                  </label>
                  <input
                    type="text"
                    value={specs.generatorName}
                    onChange={e => setSpecs({ ...specs, generatorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    طراز ونوع المحرك (Engine Model)
                  </label>
                  <input
                    type="text"
                    value={specs.engineBrand}
                    onChange={e => setSpecs({ ...specs, engineBrand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    القدرة التوليدية الإجمالية (KVA)
                  </label>
                  <input
                    type="number"
                    value={specs.kvaCapacity}
                    onChange={e => setSpecs({ ...specs, kvaCapacity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    أقصى تيار خرج (أمبير / Ampere)
                  </label>
                  <input
                    type="number"
                    value={specs.totalAmpCapacity}
                    onChange={e => setSpecs({ ...specs, totalAmpCapacity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-amber-500 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سعة خزان الوقود (لتر / Liters)
                  </label>
                  <input
                    type="number"
                    value={specs.fuelTankCapacityLiters}
                    onChange={e =>
                      setSpecs({ ...specs, fuelTankCapacityLiters: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    معدل حرق الوقود بالساعة (لتر/ساعة)
                  </label>
                  <input
                    type="number"
                    value={specs.fuelBurnRatePerHour}
                    onChange={e =>
                      setSpecs({ ...specs, fuelBurnRatePerHour: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم صاحب المحطة / المدير المسؤول
                  </label>
                  <input
                    type="text"
                    value={specs.ownerName}
                    onChange={e => setSpecs({ ...specs, ownerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم هاتف الإدارة
                  </label>
                  <input
                    type="text"
                    value={specs.ownerPhone}
                    onChange={e => setSpecs({ ...specs, ownerPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الموقع الجغرافي / عنوان محطة التوليد
                </label>
                <input
                  type="text"
                  value={specs.location}
                  onChange={e => setSpecs({ ...specs, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* ================= 2. Lines & Distribution Zones CRUD ================= */}
          {folderKey === 'lines_zones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  قواطع التوزيع وخطوط الأحمال ({currentLines.length} خطوط مسجلة):
                </span>
                <button
                  onClick={handleAddLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة خط وقاطع جديد</span>
                </button>
              </div>

              <div className="space-y-3">
                {currentLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={line.name}
                          onChange={e => handleUpdateLine(line.id, { name: e.target.value })}
                          className="font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-blue-500 outline-none px-1"
                        />
                      </div>

                      {currentLines.length > 1 && (
                        <button
                          onClick={() => handleDeleteLine(line.id)}
                          className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الخط</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                          الفيز المشبوك عليه (Phase)
                        </label>
                        <select
                          value={line.phaseType || 'phase-R'}
                          onChange={e => {
                            const val = e.target.value as PhaseType;
                            const names: Record<PhaseType, string> = {
                              'phase-R': 'فيز R (الأحمر) - 380V',
                              'phase-S': 'فيز S (الأصفر) - 380V',
                              'phase-T': 'فيز T (الأزرق) - 380V',
                              '3-phase': 'ثلاثي الفيز (3-Phase)',
                              'single-phase': 'فيز أحادي (220V)',
                            };
                            handleUpdateLine(line.id, {
                              phaseType: val,
                              phaseNameAr: names[val],
                            });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="phase-R">فيز R (الأحمر) - 380V</option>
                          <option value="phase-S">فيز S (الأصفر) - 380V</option>
                          <option value="phase-T">فيز T (الأزرق) - 380V</option>
                          <option value="3-phase">3 فاز (3-Phase)</option>
                          <option value="single-phase">أحادي (220V)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                          المنطقة الجغرافية
                        </label>
                        <input
                          type="text"
                          value={line.zone}
                          onChange={e => handleUpdateLine(line.id, { zone: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                          أقصى حمل (أمبير)
                        </label>
                        <input
                          type="number"
                          value={line.maxCapacityAmperes}
                          onChange={e =>
                            handleUpdateLine(line.id, {
                              maxCapacityAmperes: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= 3. Collectors & Staff CRUD ================= */}
          {folderKey === 'collectors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  إدارة فريق الجباية والتحصيل الميداني ({formatNumberArabic(currentCollectors.length)} جباة):
                </span>
                <button
                  onClick={handleAddCollector}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة جابي جديد</span>
                </button>
              </div>

              <div className="space-y-3.5">
                {currentCollectors.map((c, idx) => {
                  const isPassVisible = showPasscodes[c.id] || false;
                  const isPermsOpen = expandedPermissions[c.id] ?? true;
                  const perms = c.permissions || {
                    canCollectPayments: true,
                    canCancelPayments: false,
                    canAddSubscribers: false,
                    canEditSubscribers: false,
                    canDeleteSubscribers: false,
                    canApplyFreeExemption: false,
                    canPrintReceipts: true,
                    canViewFinancialReports: false,
                    canAccessSystemSettings: false,
                  };

                  const isSupervisor =
                    perms.canCollectPayments &&
                    perms.canCancelPayments &&
                    perms.canAddSubscribers &&
                    perms.canEditSubscribers;

                  return (
                    <div
                      key={c.id}
                      className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5"
                    >
                      {/* Collector Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 dark:text-white text-sm">
                                {c.name || `جابي #${idx + 1}`}
                              </span>
                              {isSupervisor ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  مشرف ميداني
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  جابي تحصيل
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedPermissions(prev => ({
                                ...prev,
                                [c.id]: !isPermsOpen,
                              }))
                            }
                            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                            <span>{isPermsOpen ? 'إخفاء الصلاحيات' : 'تعديل الصلاحيات'}</span>
                          </button>

                          <button
                            onClick={() => handleDeleteCollector(c.id)}
                            className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>

                      {/* Primary Info & Passcode Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                            اسم الجابي
                          </label>
                          <input
                            type="text"
                            value={c.name}
                            onChange={e => handleUpdateCollector(c.id, { name: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                            رقم الهاتف (اسم المستخدم)
                          </label>
                          <input
                            type="text"
                            value={c.phone}
                            onChange={e => handleUpdateCollector(c.id, { phone: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                            الخط المخصص
                          </label>
                          <select
                            value={c.assignedLineId}
                            onChange={e => {
                              const line = currentLines.find(l => l.id === e.target.value);
                              handleUpdateCollector(c.id, {
                                assignedLineId: e.target.value,
                                assignedLineName: line?.name || 'الخط المخصص',
                              });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {currentLines.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Passcode Field for Future Login */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-slate-700 dark:text-slate-300 font-black flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-500" />
                              <span>الرمز السري للحساب</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleGenerateNewPin(c.id)}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                              title="توليد رمز سري جديد"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>توليد</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={isPassVisible ? 'text' : 'password'}
                              value={c.passcode || '1234'}
                              onChange={e => handleUpdateCollector(c.id, { passcode: e.target.value })}
                              placeholder="مثال: 1234"
                              className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasscodes(prev => ({
                                  ...prev,
                                  [c.id]: !isPassVisible,
                                }))
                              }
                              className="absolute left-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {isPassVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Permissions Panel */}
                      {isPermsOpen && (
                        <div className="mt-2 p-3.5 rounded-xl bg-white dark:bg-[#0c1527] border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                              <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              <span>صلاحيات الجابي (ما يمكنه رؤيته وتعديله):</span>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">قوالب جاهزة:</span>
                              <button
                                type="button"
                                onClick={() => handleApplyPermissionPreset(c.id, 'standard')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                              >
                                تسديد فقط (قياسي)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyPermissionPreset(c.id, 'supervisor')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                              >
                                مشرف ميداني
                              </button>
                            </div>
                          </div>

                          {/* Granular Permission Toggles Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {/* 1. canCollectPayments */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canCollectPayments}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canCollectPayments',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                تسديد وقبض الاشتراكات
                              </div>
                            </label>

                            {/* 2. canPrintReceipts */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canPrintReceipts}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canPrintReceipts',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                طباعة ومشاركة وصولات القبض
                              </div>
                            </label>

                            {/* 3. canCancelPayments */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canCancelPayments}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canCancelPayments',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                إلغاء التسديد وتوثيق السبب
                              </div>
                            </label>

                            {/* 4. canApplyFreeExemption */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canApplyFreeExemption}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canApplyFreeExemption',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                منح إعفاء تسديد مجاني
                              </div>
                            </label>

                            {/* 5. canAddSubscribers */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canAddSubscribers}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canAddSubscribers',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                إضافة مشتركين جدد
                              </div>
                            </label>

                            {/* 6. canEditSubscribers */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canEditSubscribers}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canEditSubscribers',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                تعديل بيانات المشتركين
                              </div>
                            </label>

                            {/* 7. canDeleteSubscribers */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canDeleteSubscribers}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canDeleteSubscribers',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                حذف المشتركين
                              </div>
                            </label>

                            {/* 8. canViewFinancialReports */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canViewFinancialReports}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canViewFinancialReports',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                عرض التقارير المالية والإيرادات
                              </div>
                            </label>

                            {/* 9. canAccessSystemSettings */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={perms.canAccessSystemSettings}
                                onChange={e =>
                                  handleUpdateCollectorPermission(
                                    c.id,
                                    'canAccessSystemSettings',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                              />
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                الوصول لإعدادات المنظومة والمولد
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 4. Invoices templates ================= */}
          {folderKey === 'invoices_templates' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ترويسة الوصل الرسمية
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.headerTitle}
                    onChange={e =>
                      setCurrentTemplate({ ...currentTemplate, headerTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    العنوان الفرعي للوصل
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.subTitle}
                    onChange={e =>
                      setCurrentTemplate({ ...currentTemplate, subTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    أرقام هواتف الإدارة المسجلة بالوصل
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.ownerPhone}
                    onChange={e =>
                      setCurrentTemplate({ ...currentTemplate, ownerPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حجم ورق الطباعة الافتراضي
                  </label>
                  <select
                    value={currentTemplate.paperSize}
                    onChange={e =>
                      setCurrentTemplate({
                        ...currentTemplate,
                        paperSize: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="thermal">طابعة حرارية سريعة (80mm Thermal POS)</option>
                    <option value="a5">ورق نصف صفحة (A5 Receipt)</option>
                    <option value="a4">ورق صفحة كاملة (A4 Full Page)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص التذييل والشروط القانونية
                </label>
                <textarea
                  rows={3}
                  value={currentTemplate.footerNotes}
                  onChange={e =>
                    setCurrentTemplate({ ...currentTemplate, footerNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* ================= 5. Backup & Restore ================= */}
          {folderKey === 'backup_data' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    النسخ الاحتياطي الشامل واستعادة البيانات
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                    يمكنك تصدير قاعدة البيانات الكاملة المتضمنة المشتركين، سجلات تسعيرة الأشهر، وسجل الحركات، الخطوط، الجباة، وبيانات المولد كملف JSON مشفر، أو استعادتها في أي وقت.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={onExportBackup}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group"
                >
                  <div className="p-3 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <Download className="w-6 h-6" />
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    تصدير نسخة احتياطية (JSON)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    حفظ نسخة كاملة من سجلات المشتركين والتسعيرات على جهازك
                  </span>
                </button>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                  <div className="p-3 rounded-2xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    استيراد واستعادة نسخة احتياطية
                  </span>
                  <span className="text-[11px] text-slate-500">
                    انقر لاختيار ملف JSON من جهازك لاستعادة النظام
                  </span>
                </div>
              </div>

              {/* Reset to Factory Defaults */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                {!resetConfirm ? (
                  <button
                    onClick={() => setResetConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>إعادة ضبط المصنع للبيانات التجريبية الافتراضية</span>
                  </button>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center justify-between gap-3">
                    <span className="text-rose-900 dark:text-rose-200 font-bold text-xs">
                      هل أنت متأكد من إعادة تعيين جميع البيانات؟
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onResetFactoryData();
                          setResetConfirm(false);
                          onClose();
                        }}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs cursor-pointer"
                      >
                        نعم، إعادة الضبط
                      </button>
                      <button
                        onClick={() => setResetConfirm(false)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
          {folderKey !== 'backup_data' && folderKey !== 'audit_logs' && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'تم الحفظ!' : 'حفظ التغييرات'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

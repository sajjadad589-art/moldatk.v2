import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// -----------------------------------------------------------------------------
// 1) Replace the owner mobile subscriber surface with one REAL detail/payment
// screen. The edit form is opened only from "تعديل المشترك".
// -----------------------------------------------------------------------------
write('src/components/mobile/MobileSubscribers.tsx', `import React, { useMemo, useState } from 'react';
import { ArrowRight, Banknote, CheckCircle2, ChevronLeft, MessageCircle, Phone, Plus, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { Subscriber, SubscriptionTierPricing, LineDistribution } from '../../types';
import { formatCurrency, formatNumberArabic } from '../../utils/formatters';
import { getSubscriberOutstanding } from '../../utils/paymentFlow';
import { getSubscriberStyleByStatus } from '../SubscribersView';

type MobilePaymentMode = 'full' | 'fixed' | 'partial' | 'free';

interface MobileSubscribersProps {
  subscribers: Subscriber[];
  pricingTiers: SubscriptionTierPricing[];
  lines: LineDistribution[];
  onTogglePaymentStatus: (subId: string) => void;
  onOpenSubscriberModal: (subscriber?: Subscriber | null) => void;
  onOpenReceiptModal: (subscriber: Subscriber) => void;
  onDeleteSubscriber: (subId: string) => void;
  onPaySubscriber: (subscriber: Subscriber, mode: MobilePaymentMode, amount?: number) => void;
}

const cleanPhone = (value?: string) => String(value || '').replace(/\\D/g, '');

export const MobileSubscribers: React.FC<MobileSubscribersProps> = ({
  subscribers,
  pricingTiers,
  lines,
  onOpenSubscriberModal,
  onPaySubscriber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial' | 'free'>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMode, setCustomMode] = useState<'fixed' | 'partial' | 'free'>('fixed');
  const [customAmount, setCustomAmount] = useState('');

  const selectedLine = useMemo(() => lines.find(line => line.id === lineFilter), [lines, lineFilter]);
  const selectedSubscriber = selectedId ? subscribers.find(sub => sub.id === selectedId) || null : null;

  const filteredSubscribers = subscribers.filter(sub => {
    const needle = searchTerm.trim().toLowerCase();
    const matchesSearch = !needle ||
      (sub.fullName || '').toLowerCase().includes(needle) ||
      (sub.phone || '').toLowerCase().includes(needle) ||
      (sub.code || sub.subscriberCode || '').toLowerCase().includes(needle) ||
      (sub.boxNumber || '').toLowerCase().includes(needle) ||
      (sub.lineName || sub.line || '').toLowerCase().includes(needle);
    const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'free' ? isFree : sub.paymentStatus === statusFilter;
    const matchesLine = lineFilter === 'all' ? true : sub.lineId === lineFilter || (!!selectedLine?.name && (sub.lineName === selectedLine.name || sub.line === selectedLine.name));
    return matchesSearch && matchesStatus && matchesLine;
  });

  const paidCount = subscribers.filter(s => s.paymentStatus === 'paid').length;
  const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;
  const unpaidCount = subscribers.filter(s => s.paymentStatus === 'unpaid').length;
  const freeCount = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free').length;

  if (selectedSubscriber) {
    const isFree = selectedSubscriber.paymentStatus === 'free' || selectedSubscriber.tier === 'free';
    const outstanding = isFree ? 0 : getSubscriberOutstanding(selectedSubscriber, pricingTiers);
    const totalDue = Math.max(0, Number(selectedSubscriber.amountDue || 0));
    const paid = Math.max(0, Number(selectedSubscriber.amountPaid || 0));
    const phone = cleanPhone(selectedSubscriber.phone);
    const statusLabel = isFree ? 'مجاني' : outstanding <= 0 ? 'مسدد' : selectedSubscriber.paymentStatus === 'partial' ? 'تسديد جزئي' : 'غير مسدد';

    const openCustom = () => {
      setCustomMode('fixed');
      setCustomAmount(outstanding > 0 ? String(outstanding) : '');
      setCustomOpen(true);
    };

    const executeCustom = () => {
      if (customMode === 'free') {
        onPaySubscriber(selectedSubscriber, 'free');
        setCustomOpen(false);
        return;
      }
      const amount = Math.max(0, Number(customAmount || 0));
      if (amount <= 0) {
        window.alert('أدخل مبلغ تسديد صحيح.');
        return;
      }
      onPaySubscriber(selectedSubscriber, customMode, amount);
      setCustomOpen(false);
    };

    return (
      <div className="p-3 max-w-lg mx-auto pb-24" dir="rtl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button type="button" onClick={() => setSelectedId(null)} className="px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">ملف المشترك</h2>
          <button type="button" onClick={() => onOpenSubscriberModal(selectedSubscriber)} className="px-3 py-2 rounded-xl bg-[#EAF1FF] text-[#1D4ED8] text-xs font-black">
            تعديل المشترك
          </button>
        </div>

        <div className="bg-white dark:bg-[#101b35] border border-slate-200 dark:border-slate-800 rounded-[22px] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-950 dark:text-white truncate">{selectedSubscriber.fullName}</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-1">{selectedSubscriber.code || selectedSubscriber.subscriberCode || '—'}</p>
              <span className={\`inline-flex mt-2 px-2.5 py-1 rounded-lg text-[10px] font-black \${isFree ? 'bg-slate-100 text-slate-600' : outstanding <= 0 ? 'bg-emerald-50 text-emerald-700' : selectedSubscriber.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}\`}>{statusLabel}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0"><UserRound className="w-6 h-6" /></div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              ['رقم الهاتف', selectedSubscriber.phone || '—'],
              ['الكابينة', selectedSubscriber.lineName || selectedSubscriber.line || '—'],
              ['عدد الأمبيرات', \`\${formatNumberArabic(selectedSubscriber.amperes)} أمبير\`],
              ['المبلغ المستحق', formatCurrency(totalDue)],
              ['المبلغ المدفوع', formatCurrency(paid)],
              ['المتبقي', formatCurrency(outstanding)],
              ['العنوان', selectedSubscriber.address || '—'],
              ['رقم الصندوق', selectedSubscriber.boxNumber || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-3">
                <span className="text-slate-500 dark:text-slate-400 font-bold">{label}</span>
                <strong className="text-slate-950 dark:text-white text-left">{value}</strong>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button type="button" disabled={isFree || outstanding <= 0} onClick={() => onPaySubscriber(selectedSubscriber, 'full')} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black flex items-center justify-center gap-1.5">
              <Banknote className="w-4 h-4" /> {outstanding <= 0 ? 'مسدد' : 'تسديد نقدي'}
            </button>
            <button type="button" disabled={!phone} onClick={() => phone && (window.location.href = \`tel:\${phone}\`)} className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40">
              <Phone className="w-4 h-4" /> اتصال
            </button>
            <button type="button" disabled={!phone} onClick={() => phone && window.open(\`https://wa.me/964\${phone.replace(/^0/, '')}\`, '_blank')} className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40">
              <MessageCircle className="w-4 h-4" /> واتساب
            </button>
          </div>

          {!isFree && outstanding > 0 && (
            <button type="button" onClick={openCustom} className="w-full mt-2.5 py-3 rounded-xl bg-[#0B1F3B] hover:bg-[#142A45] text-white text-xs font-black flex items-center justify-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#F2B544]" /> التسديد المخصص
            </button>
          )}
        </div>

        {customOpen && (
          <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setCustomOpen(false)}>
            <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-[#0f172a] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-black">خيارات التسديد المخصص</h3><button onClick={() => setCustomOpen(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {([['fixed','مقطوع'],['partial','جزئي'],['free','مجاني']] as const).map(([mode,label]) => (
                  <button type="button" key={mode} onClick={() => setCustomMode(mode)} className={\`py-2.5 rounded-xl text-xs font-black border \${customMode === mode ? 'bg-[#0B1F3B] text-white border-[#0B1F3B]' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}\`}>{label}</button>
                ))}
              </div>
              {customMode !== 'free' && (
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-bold text-slate-500">مبلغ التسديد</label>
                  <input type="number" inputMode="numeric" min={1} max={Math.max(1, outstanding)} value={customAmount} onChange={e => setCustomAmount(e.target.value)} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-base font-black outline-none" placeholder="0" />
                  <p className="text-[10px] text-slate-400">المتبقي الحالي: {formatCurrency(outstanding)}</p>
                </div>
              )}
              {customMode === 'free' && <div className="mb-4 rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 text-xs font-bold text-slate-600 dark:text-slate-300">سيتم تسجيل الشهر الحالي كتسديد مجاني مع بقاء أي ديون أقدم كما هي.</div>}
              <button type="button" onClick={executeCustom} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> تأكيد التسديد</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-2.5 max-w-lg mx-auto pb-24">
      <div className="space-y-2 sticky top-[53px] z-30 bg-slate-50/95 dark:bg-[#070d1e]/95 backdrop-blur-md pt-1 pb-2">
        <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" /><input type="text" placeholder="بحث بالاسم، الهاتف، الكود أو القاطع..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-9 py-2 text-[11px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] text-slate-800 dark:text-slate-100 outline-none" />{searchTerm && <button onClick={() => setSearchTerm('')} className="absolute left-3 top-2.5 text-slate-400"><X className="w-4 h-4" /></button>}</div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar"><button onClick={() => setLineFilter('all')} className={\`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap border \${lineFilter === 'all' ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800'}\`}>كل الكابينات</button>{lines.map(line => <button key={line.id} onClick={() => setLineFilter(line.id)} className={\`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap border \${lineFilter === line.id ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800'}\`}>{line.name}</button>)}</div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">{([['all',\`الكل (\${formatNumberArabic(subscribers.length)})\`],['unpaid',\`غير مسدد (\${formatNumberArabic(unpaidCount)})\`],['paid',\`مسدد (\${formatNumberArabic(paidCount)})\`],['partial',\`جزئي (\${formatNumberArabic(partialCount)})\`],['free',\`مجاني (\${formatNumberArabic(freeCount)})\`]] as const).map(([id,label]) => <button key={id} onClick={() => setStatusFilter(id)} className={\`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border \${statusFilter === id ? 'bg-[#0B1F3B] text-white border-[#0B1F3B]' : 'bg-white dark:bg-[#111c38] border-slate-200 dark:border-slate-800'}\`}>{label}</button>)}</div>
      </div>

      <div className="space-y-2">
        {filteredSubscribers.map(sub => {
          const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';
          const styles = getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus);
          const outstanding = isFree ? 0 : getSubscriberOutstanding(sub, pricingTiers);
          return <button type="button" key={sub.id} onClick={() => setSelectedId(sub.id)} className={\`w-full text-right rounded-2xl px-3 py-3 transition-all \${styles.cardBg} \${styles.cardBorderAccent}\`}><div className="grid grid-cols-[1fr_auto] gap-3 items-center"><div className="min-w-0"><h4 className={\`text-sm font-black truncate \${styles.nameText}\`}>{sub.fullName}</h4><div className="mt-1 flex items-center gap-2 text-[10px] text-white/70"><span>{sub.lineName || sub.line || 'بدون كابينة'}</span><span>•</span><span>{formatNumberArabic(sub.amperes)} أمبير</span></div></div><div className="flex items-center gap-2"><div className="text-left"><span className="block text-[9px] text-white/70">المتبقي</span><strong className="text-sm text-white">{isFree ? 'مجاني' : formatCurrency(outstanding)}</strong></div><ChevronLeft className="w-4 h-4 text-white/70" /></div></div></button>;
        })}
        {filteredSubscribers.length === 0 && <div className="py-14 text-center text-xs text-slate-400 font-bold">لا توجد نتائج مطابقة</div>}
      </div>

      <button onClick={() => onOpenSubscriberModal(null)} className="fixed bottom-20 left-3 z-40 w-11 h-11 rounded-2xl bg-[#0B1F3B] text-white shadow-xl flex items-center justify-center" title="إضافة مشترك جديد"><Plus className="w-5 h-5" /></button>
    </div>
  );
};
`);

// -----------------------------------------------------------------------------
// 2) MobileLayout carries a real payment callback to the subscriber screen.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let src = read(path);
  if (!src.includes("onPaySubscriber: (subscriber: Subscriber, mode: 'full' | 'fixed' | 'partial' | 'free', amount?: number) => void;")) {
    src = src.replace(
      '  onTogglePaymentStatus: (subId: string) => void;',
      "  onTogglePaymentStatus: (subId: string) => void;\n  onPaySubscriber: (subscriber: Subscriber, mode: 'full' | 'fixed' | 'partial' | 'free', amount?: number) => void;"
    );
  }
  if (!src.includes('  onPaySubscriber,\n  onUpdateSpecs,')) {
    src = src.replace('  onTogglePaymentStatus,\n  onUpdateSpecs,', '  onTogglePaymentStatus,\n  onPaySubscriber,\n  onUpdateSpecs,');
  }
  if (!src.includes('            onPaySubscriber={onPaySubscriber}')) {
    src = src.replace('            onDeleteSubscriber={onDeleteSubscriber}\n          />', '            onDeleteSubscriber={onDeleteSubscriber}\n            onPaySubscriber={onPaySubscriber}\n          />');
  }
  must(src.includes('onPaySubscriber={onPaySubscriber}'), 'MobileLayout payment callback missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 3) App owns the accounting mutation and immediately opens the receipt with
// auto-print. This keeps local/cloud sync and audit behavior centralized.
// -----------------------------------------------------------------------------
{
  const path = 'src/App.tsx';
  let src = read(path);
  if (!src.includes("from './utils/paymentFlow';")) {
    src = src.replace("import { calculateSubscriberBill } from './utils/formatters';", "import { calculateSubscriberBill } from './utils/formatters';\nimport { applySubscriberPayment, getSubscriberOutstanding } from './utils/paymentFlow';");
  }

  if (!src.includes('const handleMobileSubscriberPayment =')) {
    const marker = '  if (!userSession) {';
    must(src.includes(marker), 'App login marker missing');
    const handler = `  const handleMobileSubscriberPayment = (inputSubscriber: Subscriber, mode: 'full' | 'fixed' | 'partial' | 'free', amount: number = 0) => {\n    const subscriber = subscribers.find(s => s.id === inputSubscriber.id) || inputSubscriber;\n    const now = new Date();\n    const monthId = activeMonthRecord?.id || \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;\n    const monthNameAr = activeMonthRecord?.monthNameAr || \`شهر \${now.getMonth() + 1}/\${now.getFullYear()}\`;\n\n    try {\n      if (mode === 'free') {\n        const history = [...(subscriber.invoicesHistory || [])];\n        const existingIndex = history.findIndex(inv => inv.monthId === monthId && inv.status !== 'cancelled');\n        const previous = existingIndex >= 0 ? history[existingIndex] : null;\n        const freeInvoice: SubscriberInvoice = {\n          id: previous?.id || \`inv-free-\${Date.now()}-\${subscriber.id}\`,\n          subscriberId: subscriber.id,\n          receiptNumber: previous?.receiptNumber || \`REC-\${subscriber.code || subscriber.subscriberCode || 'MW'}-\${Date.now().toString().slice(-6)}\`,\n          monthId,\n          monthNameAr,\n          issueDate: previous?.issueDate || now.toISOString().slice(0, 10),\n          paymentDate: now.toISOString(),\n          amperes: subscriber.amperes,\n          tier: subscriber.tier,\n          pricePerAmpere: 0,\n          fixedFee: 0,\n          totalAmount: 0,\n          paidAmount: 0,\n          remainingAmount: 0,\n          status: 'free',\n          collectorName: 'الإدارة العامة',\n        };\n        if (existingIndex >= 0) history[existingIndex] = freeInvoice;\n        else history.unshift(freeInvoice);\n        const outstandingAfter = history\n          .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free')\n          .reduce((sum, inv) => sum + Math.max(0, Number(inv.remainingAmount ?? (Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)))), 0);\n        const updated: Subscriber = {\n          ...subscriber,\n          invoicesHistory: history,\n          amountDue: outstandingAfter,\n          amountPaid: 0,\n          paymentStatus: outstandingAfter > 0 ? 'unpaid' : 'free',\n          lastPaymentDate: now.toISOString(),\n        };\n        handleSaveSubscriber(updated);\n        addAuditLog({ category: 'payment', title: 'تسديد مجاني', details: \`تسجيل الشهر الحالي مجاناً للمشترك "\${subscriber.fullName}"\`, entityId: subscriber.id, entityName: subscriber.fullName, actorName: 'الإدارة العامة', amount: 0 });\n        setSelectedReceiptSubscriber(updated);\n        setSelectedReceiptInvoice(freeInvoice);\n        setAutoPrintReceipt(true);\n        setIsReceiptModalOpen(true);\n        return;\n      }\n\n      const outstanding = getSubscriberOutstanding(subscriber, pricingTiers);\n      const requested = mode === 'full' ? outstanding : Math.min(outstanding, Math.max(0, Number(amount || 0)));\n      if (outstanding <= 0 || requested <= 0) { showToast('لا يوجد مبلغ متبقٍ للتسديد'); return; }\n      const result = applySubscriberPayment(subscriber, pricingTiers, requested, { activeMonthId: monthId, activeMonthNameAr: monthNameAr, collectorName: 'الإدارة العامة' });\n      handleSaveSubscriber(result.updatedSubscriber);\n      addAuditLog({\n        category: 'payment',\n        title: mode === 'full' ? 'تسديد نقدي' : mode === 'fixed' ? 'تسديد مقطوع' : 'تسديد جزئي',\n        details: \`تسديد للمشترك "\${subscriber.fullName}" بمبلغ \${result.meta.paymentAmount}\`,\n        entityId: subscriber.id,\n        entityName: subscriber.fullName,\n        actorName: 'الإدارة العامة',\n        amount: result.meta.paymentAmount,\n      });\n      setSelectedReceiptSubscriber(result.updatedSubscriber);\n      setSelectedReceiptInvoice(result.receiptInvoice);\n      setAutoPrintReceipt(true);\n      setIsReceiptModalOpen(true);\n    } catch (error) {\n      console.error('Mobile subscriber payment failed:', error);\n      showToast('تعذر تنفيذ التسديد، حاول مرة أخرى');\n    }\n  };\n\n`;
    src = src.replace(marker, handler + marker);
  }

  if (!src.includes('          onPaySubscriber={handleMobileSubscriberPayment}')) {
    src = src.replace('          onTogglePaymentStatus={() => {}}\n          onUpdateSpecs=', '          onTogglePaymentStatus={() => {}}\n          onPaySubscriber={handleMobileSubscriberPayment}\n          onUpdateSpecs=');
  }
  must(src.includes('onPaySubscriber={handleMobileSubscriberPayment}'), 'App mobile payment prop missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 4) Editing is now the ONLY second screen: open directly in edit mode, keep the
// delete button inside it, and close after save instead of falling back to a
// duplicate payment view.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/SubscriberModal.tsx';
  let src = read(path);
  src = src.replace("setCustomAmount(getSubscriberOutstanding(subscriberToEdit, pricingTiers).toString());\n      setIsEditing(false);", "setCustomAmount(getSubscriberOutstanding(subscriberToEdit, pricingTiers).toString());\n      setIsEditing(true);");
  src = src.replace('    setIsEditing(false);\n    if (!subscriberToEdit) onClose();', '    setIsEditing(false);\n    onClose();');
  must(src.includes('setIsEditing(true);'), 'Subscriber editor direct-edit mode missing');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 5) Receipt feed animation + automatic close after auto-print. The visual paper
// feed remains on screen for the print duration and disappears when printing is
// considered complete.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  let src = read(path);
  src = src.replace("import React, { useEffect, useRef } from 'react';", "import React, { useEffect, useRef, useState } from 'react';");
  if (!src.includes('const [isReceiptFeeding, setIsReceiptFeeding]')) {
    src = src.replace("  const lastAutoPrintedReceiptRef = useRef('');", "  const lastAutoPrintedReceiptRef = useRef('');\n  const [isReceiptFeeding, setIsReceiptFeeding] = useState(false);");
  }
  const oldEffect = `    const timer = window.setTimeout(() => { void handlePrint(); }, 450);\n    return () => window.clearTimeout(timer);`;
  const newEffect = `    setIsReceiptFeeding(true);\n    const timer = window.setTimeout(() => {\n      void handlePrint();\n      window.setTimeout(() => {\n        setIsReceiptFeeding(false);\n        onClose();\n      }, 2200);\n    }, 260);\n    return () => window.clearTimeout(timer);`;
  if (src.includes(oldEffect)) src = src.replace(oldEffect, newEffect);
  else if (!src.includes('setIsReceiptFeeding(true);')) {
    src = src.replace('    lastAutoPrintedReceiptRef.current = receiptKey;', '    lastAutoPrintedReceiptRef.current = receiptKey;\n    setIsReceiptFeeding(true);');
  }
  src = src.replace('id="thermal-receipt-printable" className="bg-white text-slate-950 rounded-xl p-3 shadow-lg border border-slate-300 w-[260px] text-xs"', 'id="thermal-receipt-printable" className={`bg-white text-slate-950 rounded-xl p-3 shadow-lg border border-slate-300 w-[260px] text-xs ${isReceiptFeeding ? \'moldatk-receipt-feed\' : \'\'}`}');
  must(src.includes('moldatk-receipt-feed'), 'Receipt feed class missing');
  must(src.includes('onClose();'), 'Receipt auto-close missing');
  write(path, src);
}

{
  const path = 'src/index.css';
  let src = read(path);
  if (!src.includes('MOLDATK_RECEIPT_FEED_V1')) {
    src += `\n/* MOLDATK_RECEIPT_FEED_V1 */\n@keyframes moldatk-receipt-feed {\n  0% { transform: translateY(-38%); clip-path: inset(0 0 78% 0 round 12px); opacity: .72; }\n  35% { opacity: 1; }\n  100% { transform: translateY(0); clip-path: inset(0 0 0 0 round 12px); opacity: 1; }\n}\n.moldatk-receipt-feed { animation: moldatk-receipt-feed 1.85s cubic-bezier(.22,.8,.24,1) both; transform-origin: top center; }\n`;
  }
  write(path, src);
}

console.log('Applied owner mobile real payment screen, direct edit flow, custom payment placement, receipt auto-close and animated receipt feed.');

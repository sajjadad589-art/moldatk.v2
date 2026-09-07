import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const subscriberPath = 'src/components/SubscriberModal.tsx';
let source = read(subscriberPath);
if (!source) throw new Error('Subscriber payment UX finalizer: SubscriberModal.tsx missing');

// Keep the receipt callback capable of requesting auto-print, but payment must be saved first.
source = source.replace(
  /onOpenReceiptModal\?: \(sub: Subscriber, invoice\?: SubscriberInvoice(?:, autoPrint\?: boolean)?\) => void;/,
  'onOpenReceiptModal?: (sub: Subscriber, invoice?: SubscriberInvoice, autoPrint?: boolean) => void;'
);

// Make quick payment an actual accounting operation first, then open/print the generated receipt.
const quickStart = source.indexOf('  const handleQuickPayment = () => {');
const quickEnd = quickStart >= 0 ? source.indexOf('\n\n  const handleCustomPayment', quickStart) : -1;
if (quickStart < 0 || quickEnd < 0) throw new Error('Subscriber payment UX finalizer: handleQuickPayment block not found');

const quickPaymentHandler = `  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const totalOutstanding = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);

    // A fully settled subscriber uses the same prominent button to enter the cancel-payment flow.
    if (totalOutstanding <= 0) {
      setIsConfirmUnpaidOpen(true);
      return;
    }

    const now = new Date();
    const allocation = applyPaymentOldestFirst(
      subscriberToEdit,
      pricingTiers,
      totalOutstanding,
      now,
      monthId,
      monthName
    );
    const current = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled') || ensured.currentInvoice;

    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(current.paidAmount || 0),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      lastPaymentDate: now.toISOString(),
    };

    const receipt: SubscriberInvoice = {
      ...current,
      id: 'receipt-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: totalOutstanding,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
    };

    // IMPORTANT: persist the payment first. Receipt opening/printing is only the post-payment step.
    onSaveSubscriber(updated);
    if (onAddAuditLog) {
      onAddAuditLog({
        category: 'payment',
        title: 'تسديد المشترك',
        details: 'تم تنفيذ التسديد فعلياً وتوزيع المبلغ على الديون الأقدم أولاً ثم الشهر الحالي',
        entityId: updated.id,
        entityName: updated.fullName + ' (' + (updated.code || updated.subscriberCode || '') + ')',
        actorName: 'الإدارة العامة',
        amount: totalOutstanding,
      });
    }

    // Open the receipt only after save has been issued, then trigger automatic print.
    if (onOpenReceiptModal) {
      window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120);
    }
  };`;
source = source.slice(0, quickStart) + quickPaymentHandler + source.slice(quickEnd);

// Custom/partial payments also save first, then auto-print only for a real paid amount.
source = source.replace(
  /if \(onOpenReceiptModal && finalPaid > 0\) onOpenReceiptModal\(updated, receipt(?:, true)?\); else onClose\(\);/,
  "if (onOpenReceiptModal && finalPaid > 0) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();"
);
source = source.replace(
  /if \(status !== 'free' && onOpenReceiptModal\) onOpenReceiptModal\(updated, invoice(?:, true)?\);/,
  "if (status !== 'free' && onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, invoice, true), 120);"
);

// Rebuild the first subscriber page so all payment actions are immediately visible there.
const profileStart = "        {activeView === 'profile' && !isEditing && subscriberToEdit ? (";
const historyStart = "        ) : activeView === 'history' && subscriberToEdit ? (";
const profileIndex = source.indexOf(profileStart);
const historyIndex = profileIndex >= 0 ? source.indexOf(historyStart, profileIndex) : -1;
if (profileIndex < 0 || historyIndex < 0) throw new Error('Subscriber payment UX finalizer: profile/history block not found');

const firstPage = `        {activeView === 'profile' && !isEditing && subscriberToEdit ? (
          <div className="min-h-full p-4 sm:p-5 pb-8">
            <div className="grid grid-cols-3 items-center mb-4">
              <button type="button" onClick={onClose} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">رجوع</button>
              <h2 className="text-center text-base font-black text-slate-950 dark:text-white">ملف المشترك</h2>
              <button type="button" onClick={() => setIsEditing(true)} className="justify-self-end px-3 py-2 rounded-xl bg-[#071a34] text-white text-xs font-black flex items-center gap-1.5 shadow-sm"><Edit3 className="w-3.5 h-3.5" />تعديل</button>
            </div>

            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm mb-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-3xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 flex items-center justify-center"><UserRound className="w-8 h-8" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-black text-slate-950 dark:text-white truncate">{subscriberToEdit.fullName}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5" dir="ltr">{subscriberToEdit.code || subscriberToEdit.subscriberCode}</div>
                  <span className={\`inline-flex mt-2 px-3 py-1 rounded-full border text-[10px] font-black \${paymentStatusClass(subscriberToEdit.paymentStatus)}\`}>{paymentStatusLabel(subscriberToEdit.paymentStatus)}</span>
                </div>
              </div>
            </div>

            {!isFree && (
              <button
                type="button"
                onClick={handleQuickPayment}
                className={\`w-full min-h-[72px] py-4 px-5 rounded-2xl text-white font-black shadow-xl transition-all active:scale-[0.985] flex items-center justify-center gap-3 mb-3 \${isPaid ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'}\`}
              >
                <CheckCircle2 className="w-7 h-7 shrink-0" />
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-base">{isPaid ? 'إلغاء التسديد' : 'تسديد المشترك'}</span>
                  {!isPaid && <span className="text-xs mt-1 opacity-95">تسديد الآن: {formatCurrency(outstanding || currentCalc.total)}</span>}
                </span>
              </button>
            )}

            {!isPaid && !isFree && (
              <button
                type="button"
                onClick={() => { setCustomAmount(String(outstanding || currentCalc.total)); setCustomError(''); setIsAdvancedOpen(true); }}
                className="w-full py-3.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-sm font-black text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2 mb-2.5"
              >
                <Sliders className="w-5 h-5" />تسديد مخصص / جزئي
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveView('history')}
              className="w-full py-3.5 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-sm font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 mb-3"
            >
              <History className="w-5 h-5 text-blue-500" />الفواتير السابقة ({subscriberToEdit.invoicesHistory?.length || 0})
            </button>

            <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <DetailRow label="رقم الهاتف" value={subscriberToEdit.phone ? <span dir="ltr">{subscriberToEdit.phone}</span> : '—'} />
              <DetailRow label="الكابينة" value={subscriberToEdit.lineName || subscriberToEdit.line || '—'} strong />
              <DetailRow label="عدد الأمبيرات" value={\`\${formatNum(subscriberToEdit.amperes)} أمبير\`} strong />
              <DetailRow label="المبلغ المستحق" value={formatCurrency(billedAmount)} strong />
              <DetailRow label="المبلغ المدفوع" value={formatCurrency(paid)} strong />
              <DetailRow label="المتبقي" value={formatCurrency(outstanding)} strong />
              <DetailRow label="العنوان" value={subscriberToEdit.address || '—'} />
              <DetailRow label="رقم الصندوق" value={subscriberToEdit.boxNumber || '—'} />
              <DetailRow label="ملاحظات" value={subscriberToEdit.notes || '—'} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" onClick={handleWhatsApp} disabled={!subscriberToEdit.phone} className="py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5 disabled:opacity-40"><MessageCircle className="w-4 h-4 text-emerald-500" />واتساب</button>
              <button type="button" onClick={handleCall} disabled={!subscriberToEdit.phone} className="py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5 disabled:opacity-40"><Phone className="w-4 h-4 text-blue-500" />اتصال</button>
            </div>
          </div>
`;
source = source.slice(0, profileIndex) + firstPage + source.slice(historyIndex);

// Delete belongs only to edit mode. Remove any stale duplicate and inject it immediately under save.
const deleteInEditMarker = 'MOLDATK_EDIT_DELETE_ONLY_V1';
if (!source.includes(deleteInEditMarker)) {
  const saveButtonPattern = /(<button type="submit" className="[^"]+">\{subscriberToEdit \? 'حفظ التعديلات' : 'إضافة المشترك'\}<\/button>)/;
  if (!saveButtonPattern.test(source)) throw new Error('Subscriber payment UX finalizer: edit save button not found');
  source = source.replace(
    saveButtonPattern,
    `$1\n            {/* ${deleteInEditMarker} */}\n            {subscriberToEdit && onDeleteSubscriber && (\n              <button type="button" onClick={() => setIsConfirmDeleteOpen(true)} className="w-full py-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/5 text-rose-600 text-xs font-black flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف المشترك</button>\n            )}`
  );
}

write(subscriberPath, source);

const final = read(subscriberPath);
if (!final.includes("'تسديد المشترك'")) throw new Error('Subscriber payment UX finalizer: prominent payment button missing');
if (!final.includes('تسديد مخصص / جزئي')) throw new Error('Subscriber payment UX finalizer: custom payment button missing');
if (!final.includes('الفواتير السابقة')) throw new Error('Subscriber payment UX finalizer: previous invoices button missing');
if (!final.includes("title: 'تسديد المشترك'")) throw new Error('Subscriber payment UX finalizer: actual payment handler missing');
if (!final.includes('onSaveSubscriber(updated);')) throw new Error('Subscriber payment UX finalizer: payment persistence missing');
if (!final.includes('onOpenReceiptModal(updated, receipt, true)')) throw new Error('Subscriber payment UX finalizer: post-save auto print missing');
if (!final.includes(deleteInEditMarker)) throw new Error('Subscriber payment UX finalizer: delete action not moved to edit mode');

console.log('Subscriber first page now owns real payment, custom payment and previous invoices; edit mode owns update/delete only.');

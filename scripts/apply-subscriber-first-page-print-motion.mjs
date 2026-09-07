import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const subscriberPath = 'src/components/SubscriberModal.tsx';
let subscriber = read(subscriberPath);
if (!subscriber) throw new Error('Subscriber first-page patch: SubscriberModal.tsx missing');

subscriber = subscriber.replace(
  /onOpenReceiptModal\?: \(sub: Subscriber, invoice\?: SubscriberInvoice(?:, autoPrint\?: boolean)?\) => void;/,
  'onOpenReceiptModal?: (sub: Subscriber, invoice?: SubscriberInvoice, autoPrint?: boolean) => void;'
);

subscriber = subscriber.replace(/onOpenReceiptModal\(updated,\s*(invoice|receipt)\)(?!,)/g, 'onOpenReceiptModal(updated, $1, true)');
subscriber = subscriber.replace(/onOpenReceiptModal\?\.\(subscriberToEdit,\s*inv\)(?!,)/g, 'onOpenReceiptModal?.(subscriberToEdit, inv, false)');

const profileStart = "        {activeView === 'profile' && !isEditing && subscriberToEdit ? (";
const historyStart = "        ) : activeView === 'history' && subscriberToEdit ? (";
const startIndex = subscriber.indexOf(profileStart);
const historyIndex = startIndex >= 0 ? subscriber.indexOf(historyStart, startIndex) : -1;
if (startIndex < 0 || historyIndex < 0) throw new Error('Subscriber first-page patch: profile/history block not found');

const unifiedProfile = `        {activeView === 'profile' && !isEditing && subscriberToEdit ? (
          <div className="min-h-full p-4 sm:p-5 pb-8">
            <div className="grid grid-cols-3 items-center mb-4">
              <button type="button" onClick={onClose} className="justify-self-start px-3 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200">رجوع</button>
              <h2 className="text-center text-base font-black text-slate-950 dark:text-white">بيانات المشترك</h2>
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
                className={\`w-full min-h-[64px] py-4 px-4 rounded-2xl text-white font-black shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3 mb-3 \${isPaid ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'}\`}
              >
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-sm">{isPaid ? 'إلغاء التسديد' : 'تسديد الاشتراك وطباعة الوصل'}</span>
                  {!isPaid && <span className="text-[11px] mt-1 opacity-90">{formatCurrency(outstanding || currentCalc.total)}</span>}
                </span>
              </button>
            )}

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

            {!isPaid && !isFree && (
              <button type="button" onClick={() => { setCustomAmount(String(outstanding || currentCalc.total)); setCustomError(''); setIsAdvancedOpen(true); }} className="mt-2.5 w-full py-3 rounded-2xl bg-slate-100 dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><Sliders className="w-4 h-4 text-blue-500" />تسديد مخصص / جزئي</button>
            )}

            <button type="button" onClick={() => setActiveView('history')} className="mt-2.5 w-full py-3 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><History className="w-4 h-4 text-blue-500" />سجل الدفعات والفواتير ({subscriberToEdit.invoicesHistory?.length || 0})</button>

            {onDeleteSubscriber && (
              <button type="button" onClick={() => setIsConfirmDeleteOpen(true)} className="mt-3 w-full py-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/5 text-rose-600 text-xs font-black flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف المشترك</button>
            )}
          </div>
`;
subscriber = subscriber.slice(0, startIndex) + unifiedProfile + subscriber.slice(historyIndex);
write(subscriberPath, subscriber);

const appPath = 'src/App.tsx';
let app = read(appPath);
if (!app) throw new Error('Subscriber first-page patch: App.tsx missing');
app = app.replace(
  /onOpenReceiptModal=\{\(sub, inv\) => \{\s*setSelectedReceiptSubscriber\(sub\);\s*setSelectedReceiptInvoice\(inv \|\| null\);\s*setAutoPrintReceipt\(false\);\s*setIsReceiptModalOpen\(true\);\s*\}\}/g,
  `onOpenReceiptModal={(sub, inv, shouldAutoPrint = false) => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(inv || null);
            setAutoPrintReceipt(shouldAutoPrint);
            setIsReceiptModalOpen(true);
          }}`
);
write(appPath, app);

const receiptPath = 'src/components/InvoiceReceiptModal.tsx';
let receipt = read(receiptPath);
if (!receipt) throw new Error('Subscriber first-page patch: InvoiceReceiptModal.tsx missing');
receipt = receipt.replace("import React, { useEffect, useRef } from 'react';", "import React, { useEffect, useRef, useState } from 'react';");

if (!receipt.includes('const [printAnimationKey, setPrintAnimationKey]')) {
  receipt = receipt.replace(
    "  const lastAutoPrintedReceiptRef = useRef('');",
    "  const lastAutoPrintedReceiptRef = useRef('');\n  const [printAnimationKey, setPrintAnimationKey] = useState(0);"
  );
}

const printGuard = `    if (!finalized) {
      window.alert`;
if (!receipt.includes('MOLDATK_SCREEN_PRINT_MOTION_V2')) {
  const guardIndex = receipt.indexOf(printGuard);
  if (guardIndex < 0) throw new Error('Subscriber first-page patch: print guard not found');
  const guardClose = receipt.indexOf("    }\n\n    if (isNativeAndroid())", guardIndex);
  if (guardClose < 0) throw new Error('Subscriber first-page patch: print guard end not found');
  const insertAt = guardClose + "    }\n".length;
  const motion = `
    // MOLDATK_SCREEN_PRINT_MOTION_V2
    // The receipt animation starts only when a real print action starts.
    setPrintAnimationKey(key => key + 1);
    await new Promise<void>(resolve => window.setTimeout(resolve, 700));
`;
  receipt = receipt.slice(0, insertAt) + motion + receipt.slice(insertAt);
}

if (!receipt.includes('receipt-screen-printing')) {
  receipt = receipt.replace(
    /<div id="thermal-receipt-printable" className="([^"]+)">/,
    (_match, baseClass) => `<div
            key={printAnimationKey}
            id="thermal-receipt-printable"
            className={\`${baseClass} \${autoPrint && printAnimationKey === 0 ? 'receipt-awaiting-print' : ''} \${printAnimationKey > 0 ? 'receipt-screen-printing' : ''}\`}
          >`
  );
}

receipt = receipt.replace(
  "    const timer = window.setTimeout(() => { void handlePrint(); }, 450);",
  "    const timer = window.setTimeout(() => { void handlePrint(); }, 220);"
);
write(receiptPath, receipt);

const cssPath = 'src/index.css';
let css = read(cssPath);
if (!css) throw new Error('Subscriber first-page patch: index.css missing');
const oldMotionStart = css.indexOf('/*\n * حركة إيصال التسديد:');
const ownMotionStart = css.indexOf('/*\n * MOLDATK_SCREEN_PRINT_MOTION_V2');
const motionStart = ownMotionStart >= 0 ? ownMotionStart : oldMotionStart;
const protectionStart = css.indexOf('/* حماية واجهة الهاتف', motionStart >= 0 ? motionStart : 0);
const newMotionCss = `/*
 * MOLDATK_SCREEN_PRINT_MOTION_V2
 * حركة الطباعة المرئية تبدأ فقط عند تنفيذ أمر الطباعة.
 * الورقة تصعد من أسفل الهاتف إلى موضعها، بعكس الحركة السابقة.
 */
@keyframes moldatk-receipt-print-up {
  0% {
    transform: translateY(108vh) scale(0.97);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  78% {
    transform: translateY(-10px) scale(1.006);
    opacity: 1;
  }
  90% {
    transform: translateY(4px) scale(0.998);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.receipt-awaiting-print {
  opacity: 0;
  transform: translateY(108vh);
}

.receipt-screen-printing {
  transform-origin: bottom center;
  animation: moldatk-receipt-print-up 760ms cubic-bezier(0.18, 0.84, 0.24, 1) both;
  position: relative;
  z-index: 10;
}

.receipt-screen-printing::before {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 10px;
  right: 10px;
  height: 8px;
  border-radius: 0 0 999px 999px;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0));
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .receipt-awaiting-print {
    opacity: 1;
    transform: none;
  }
  .receipt-screen-printing {
    animation: none;
  }
}

`;
if (motionStart >= 0 && protectionStart > motionStart) {
  css = css.slice(0, motionStart) + newMotionCss + css.slice(protectionStart);
} else {
  const marker = css.indexOf('/* حماية واجهة الهاتف');
  if (marker < 0) throw new Error('Subscriber first-page patch: mobile protection css marker missing');
  css = css.slice(0, marker) + newMotionCss + css.slice(marker);
}
write(cssPath, css);

const finalSubscriber = read(subscriberPath);
const finalReceipt = read(receiptPath);
const finalApp = read(appPath);
const finalCss = read(cssPath);
if (!finalSubscriber.includes('تسديد الاشتراك وطباعة الوصل')) throw new Error('Subscriber first-page patch: prominent payment button missing');
if (!finalSubscriber.includes('onOpenReceiptModal(updated') || !finalSubscriber.includes(', true)')) throw new Error('Subscriber first-page patch: payment auto-print intent missing');
if (!finalReceipt.includes('MOLDATK_SCREEN_PRINT_MOTION_V2')) throw new Error('Subscriber first-page patch: print animation trigger missing');
if (!finalReceipt.includes('receipt-screen-printing')) throw new Error('Subscriber first-page patch: receipt animation class missing');
if (!finalCss.includes('moldatk-receipt-print-up')) throw new Error('Subscriber first-page patch: upward print css missing');
if (!finalApp.includes('setAutoPrintReceipt(shouldAutoPrint)')) throw new Error('Subscriber first-page patch: App auto-print routing missing');

console.log('Unified subscriber first page, prominent payment action, automatic print routing, and bottom-to-top receipt print animation applied.');

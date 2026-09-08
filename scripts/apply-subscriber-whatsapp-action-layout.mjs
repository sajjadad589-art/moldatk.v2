import fs from 'node:fs';

const path = 'src/components/SubscriberModal.tsx';
if (!fs.existsSync(path)) throw new Error('Subscriber WhatsApp layout: SubscriberModal.tsx missing');

let source = fs.readFileSync(path, 'utf8');

// Phone calling is intentionally removed from this subscriber interface.
source = source.replace(/\n\s*Phone,/, '');
source = source.replace(/\n\s*const handleCall = \(\) => \{[\s\S]*?\n\s*\};\n/, '\n');

// WhatsApp availability follows the stored phone value. Keep the button visible even
// when unavailable, but disable it until a phone number containing digits is present.
// This pass runs more than once in CI (lint, then build), so replace the ENTIRE helper
// region rather than starting at handleWhatsApp and accidentally duplicating constants.
const helperStart = source.indexOf('  const whatsappDigits =');
const handlerStart = source.indexOf('  const handleWhatsApp = () => {');
const whatsappStart = helperStart >= 0 && helperStart < handlerStart ? helperStart : handlerStart;
const whatsappEnd = whatsappStart >= 0 ? source.indexOf('\n\n  const handleDelete', whatsappStart) : -1;
if (whatsappStart < 0 || whatsappEnd < 0) throw new Error('Subscriber WhatsApp layout: WhatsApp helper block missing');

const whatsappHandler = `  const whatsappDigits = subscriberToEdit?.phone?.replace(/\\D/g, '') || '';
  const hasWhatsAppPhone = whatsappDigits.length > 0;

  const handleWhatsApp = () => {
    if (!hasWhatsAppPhone) return;
    const intl = whatsappDigits.startsWith('0') ? \`964\${whatsappDigits.slice(1)}\` : whatsappDigits;
    window.open(\`https://wa.me/\${intl}\`, '_blank');
  };`;
source = source.slice(0, whatsappStart) + whatsappHandler + source.slice(whatsappEnd);

const profileStart = "        {activeView === 'profile' && !isEditing && subscriberToEdit ? (";
const historyStart = "        ) : activeView === 'history' && subscriberToEdit ? (";
const profileIndex = source.indexOf(profileStart);
const historyIndex = profileIndex >= 0 ? source.indexOf(historyStart, profileIndex) : -1;
if (profileIndex < 0 || historyIndex < 0) throw new Error('Subscriber WhatsApp layout: profile/history block not found');

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

            {/* WHATSAPP_PRIMARY_ACTION_V1 */}
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={!hasWhatsAppPhone}
              aria-disabled={!hasWhatsAppPhone}
              className={\`w-full min-h-[64px] py-4 px-5 rounded-2xl text-sm font-black flex items-center justify-center gap-3 mb-3 border transition-all active:scale-[0.985] \${hasWhatsAppPhone
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'bg-slate-100 dark:bg-[#101a33] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-70'}\`}
            >
              <MessageCircle className="w-6 h-6 shrink-0" />
              <span>واتساب</span>
            </button>

            {!isPaid && !isFree && (
              <button
                type="button"
                onClick={handleQuickPayment}
                className="w-full min-h-[72px] py-4 px-5 rounded-2xl text-white font-black shadow-xl transition-all active:scale-[0.985] flex items-center justify-center gap-3 mb-3 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-7 h-7 shrink-0" />
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-base">تسديد المشترك</span>
                  <span className="text-xs mt-1 opacity-95">تسديد الآن: {formatCurrency(outstanding || currentCalc.total)}</span>
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

            {/* LOWER_PAYMENT_ACTIONS_V1 */}
            <div className="mt-3 space-y-2">
              {isPaid && !isFree && (
                <button
                  type="button"
                  onClick={handleQuickPayment}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.985] transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />إلغاء التسديد
                </button>
              )}

              {!isPaid && !isFree && (
                <button
                  type="button"
                  onClick={() => { setCustomAmount(String(outstanding || currentCalc.total)); setCustomError(''); setIsAdvancedOpen(true); }}
                  className="w-full py-3.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-sm font-black text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2"
                >
                  <Sliders className="w-5 h-5" />تسديد مخصص / جزئي
                </button>
              )}

              {/* PREVIOUS_INVOICES_BELOW_PAYMENT_V1 */}
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className="w-full py-3.5 rounded-2xl bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 text-sm font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2"
              >
                <History className="w-5 h-5 text-blue-500" />الفواتير السابقة ({subscriberToEdit.invoicesHistory?.length || 0})
              </button>
            </div>
          </div>
`;

source = source.slice(0, profileIndex) + firstPage + source.slice(historyIndex);

if (source.includes('handleCall')) throw new Error('Subscriber WhatsApp layout: call action still present');
if (source.includes('<Phone ')) throw new Error('Subscriber WhatsApp layout: phone icon still present in profile');
if (!source.includes('WHATSAPP_PRIMARY_ACTION_V1')) throw new Error('Subscriber WhatsApp layout: primary WhatsApp action missing');
if (!source.includes('disabled={!hasWhatsAppPhone}')) throw new Error('Subscriber WhatsApp layout: WhatsApp phone-state guard missing');
if (!source.includes('LOWER_PAYMENT_ACTIONS_V1')) throw new Error('Subscriber WhatsApp layout: lower payment actions missing');
if (!source.includes('PREVIOUS_INVOICES_BELOW_PAYMENT_V1')) throw new Error('Subscriber WhatsApp layout: previous invoices position marker missing');
if (!source.includes('تسديد مخصص / جزئي')) throw new Error('Subscriber WhatsApp layout: custom payment action missing');
if (!source.includes('إلغاء التسديد')) throw new Error('Subscriber WhatsApp layout: cancel payment action missing');
const lowerActionsPos = source.indexOf('LOWER_PAYMENT_ACTIONS_V1');
const invoiceButtonPos = source.indexOf('PREVIOUS_INVOICES_BELOW_PAYMENT_V1');
if (lowerActionsPos < 0 || invoiceButtonPos <= lowerActionsPos) throw new Error('Subscriber WhatsApp layout: previous invoices must remain below payment actions');

const whatsappDigitsCount = (source.match(/const whatsappDigits =/g) || []).length;
const hasWhatsAppPhoneCount = (source.match(/const hasWhatsAppPhone =/g) || []).length;
const handleWhatsAppCount = (source.match(/const handleWhatsApp =/g) || []).length;
if (whatsappDigitsCount !== 1 || hasWhatsAppPhoneCount !== 1 || handleWhatsAppCount !== 1) {
  throw new Error(`Subscriber WhatsApp layout: helper declarations must be unique (digits=${whatsappDigitsCount}, enabled=${hasWhatsAppPhoneCount}, handler=${handleWhatsAppCount})`);
}

fs.writeFileSync(path, source, 'utf8');
console.log('Subscriber profile WhatsApp/payment layout is idempotent and preserves one phone-state helper set.');

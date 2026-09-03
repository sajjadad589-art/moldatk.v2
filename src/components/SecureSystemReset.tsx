import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Trash2, X } from 'lucide-react';

export type SecureResetResult = { ok: boolean; message?: string };

interface Props {
  isOwner: boolean;
  onResetSystem: (password: string) => Promise<SecureResetResult>;
  compact?: boolean;
}

const CONFIRM_PHRASE = 'تصفير جميع بيانات مولدتك';

export const SecureSystemReset: React.FC<Props> = ({ isOwner, onResetSystem, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [seconds, setSeconds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const armed = isOwner && password.length > 0 && phrase.trim() === CONFIRM_PHRASE;

  useEffect(() => {
    if (!open || !armed) {
      setSeconds(10);
      return;
    }
    if (seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [open, armed, seconds]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setPhrase('');
    setSeconds(10);
    setError('');
  };

  const execute = async () => {
    if (!armed || seconds > 0 || busy) return;
    setBusy(true);
    setError('');
    const result = await onResetSystem(password);
    if (!result.ok) {
      setBusy(false);
      setError(result.message || 'تعذر تنفيذ التصفير. لم يتم اعتماد العملية.');
    }
  };

  if (!isOwner) return null;

  return (
    <>
      <div className={`rounded-2xl border border-rose-500/30 bg-rose-500/5 ${compact ? 'p-3' : 'p-4'}`} dir="rtl">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><AlertTriangle className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-black text-rose-300">منطقة خطرة — تصفير النظام بالكامل</h3>
            <p className="text-[10px] leading-5 text-slate-400 mt-1">يمسح بيانات التشغيل، المشتركين، الديون، التسديدات، التقارير، التسعيرات، القاصة، الكابينات وإعدادات المنظومة. حساب الدخول والاشتراك يبقيان محفوظين.</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full h-11 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs font-black flex items-center justify-center gap-2">
          <Trash2 className="w-4 h-4" /> تصفير النظام بالكامل
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#0d1730] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-rose-400" /><h2 className="text-sm font-black text-white">تأكيد أمني عالي</h2></div>
              <button type="button" onClick={close} disabled={busy} className="p-2 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-[11px] leading-6 text-rose-200">
                قبل المسح سيُنشئ التطبيق نسخة احتياطية JSON تلقائياً. العملية لا تُنفذ إلا لصاحب المولدة وبعد التحقق من كلمة المرور.
              </div>
              <label className="block">
                <span className="text-[11px] font-bold text-slate-300">كلمة مرور حسابك</span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="mt-1.5 w-full h-11 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white outline-none focus:border-rose-500" />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-slate-300">اكتب العبارة التالية حرفياً:</span>
                <div className="mt-1 text-xs font-black text-rose-300">{CONFIRM_PHRASE}</div>
                <input value={phrase} onChange={e => setPhrase(e.target.value)} className="mt-1.5 w-full h-11 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white outline-none focus:border-rose-500" />
              </label>
              {armed && seconds > 0 && <div className="text-center text-xs font-black text-amber-300">الحماية الزمنية: انتظر {seconds} ثانية</div>}
              {error && <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-[11px] text-rose-300">{error}</div>}
              <button type="button" onClick={execute} disabled={!armed || seconds > 0 || busy} className="w-full h-12 rounded-xl bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-black flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> {busy ? 'جاري إنشاء النسخة الاحتياطية والتصفير...' : seconds > 0 && armed ? `تفعيل الحذف بعد ${seconds}` : 'حذف جميع بيانات النظام نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

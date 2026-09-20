import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  Eye,
  EyeOff,
  Fingerprint,
  Factory,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import type { ActiveUserSession, Collector } from '../types';
import { supabase } from '../lib/supabase';
import {
  discoverLoginIdentifier,
  isPlatformPasskeyAvailable,
  loadSavedLoginAccounts,
  loginWithIdentifier,
  loginWithPasskey,
  registerPasskeyForCurrentAccount,
  saveLoginAccount,
  type LoginAccountRole,
  type SavedLoginAccount,
} from '../lib/authAccounts';

interface LoginViewProps {
  collectors: Collector[];
  onLoginSuccess: (session: ActiveUserSession) => void;
  forceSuperAdmin?: boolean;
}

type AddStep = 'accounts' | 'identifier' | 'secret' | 'biometric';

const cleanError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('invalid_credentials')) return 'بيانات الدخول غير صحيحة. تأكد من الرمز وحاول مرة ثانية.';
  if (message.includes('account_inactive') || message.includes('collector_not_active')) return 'هذا الحساب موقوف حالياً.';
  if (message.includes('generator_inactive')) return 'حساب المولدة موقوف حالياً.';
  if (message.includes('use_super_admin_portal')) return 'حساب السوبر أدمن يدخل من بوابة الإدارة الخاصة.';
  if (message.includes('passkey_not_supported')) return 'هذا الجهاز لا يدعم الدخول بالبصمة أو Face ID من المتصفح الحالي.';
  if (message.includes('passkey_not_registered')) return 'الدخول السريع غير مفعل لهذا الحساب على هذا الجهاز.';
  if (message.includes('challenge_expired')) return 'انتهت مهلة التحقق. حاول مرة ثانية.';
  return 'تعذر تسجيل الدخول. تحقق من الاتصال والبيانات ثم حاول مرة ثانية.';
};

const roleLabel = (role?: LoginAccountRole) => role === 'collector' ? 'جابي' : 'صاحب المولدة';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, forceSuperAdmin = false }) => {
  const [savedAccounts, setSavedAccounts] = useState<SavedLoginAccount[]>(() => loadSavedLoginAccounts());
  const [step, setStep] = useState<AddStep>('accounts');
  const [identifier, setIdentifier] = useState('');
  const [roleHint, setRoleHint] = useState<LoginAccountRole | undefined>();
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SavedLoginAccount | null>(null);
  const [pendingAccount, setPendingAccount] = useState<SavedLoginAccount | null>(null);
  const [pendingSession, setPendingSession] = useState<ActiveUserSession | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [superEmail, setSuperEmail] = useState('');
  const [superPassword, setSuperPassword] = useState('');
  const [showSuperPassword, setShowSuperPassword] = useState(false);

  useEffect(() => {
    void isPlatformPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  const refreshSaved = () => setSavedAccounts(loadSavedLoginAccounts());

  const resetAddFlow = () => {
    setIdentifier('');
    setRoleHint(undefined);
    setSecret('');
    setShowSecret(false);
    setSelectedAccount(null);
    setPendingAccount(null);
    setPendingSession(null);
    setErrorMessage(null);
    setStep('accounts');
  };

  const handleSuperAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: superEmail.trim(),
        password: superPassword,
      });
      if (error || !data.user) throw new Error('invalid_credentials');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role,generator_id,is_active')
        .eq('id', data.user.id)
        .single();
      if (profileError || !profile || !profile.is_active) throw new Error('account_inactive');
      if (profile.role !== 'super_admin' && profile.role !== 'super_admin_manager') {
        await supabase.auth.signOut();
        throw new Error('super_admin_only');
      }

      onLoginSuccess({
        role: profile.role,
        authUserId: data.user.id,
        email: data.user.email || superEmail.trim(),
        username: data.user.email || superEmail.trim(),
        generatorId: profile.generator_id,
        loginTime: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setErrorMessage(message === 'super_admin_only'
        ? 'هذا الحساب ليس حساب سوبر أدمن.'
        : cleanError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscover = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = identifier.trim();
    if (value.length < 5) {
      setErrorMessage('أدخل رقم الهاتف أو البريد الإلكتروني.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await discoverLoginIdentifier(value);
      if (!result.found || !result.roleHint) {
        setErrorMessage('لم يتم العثور على حساب فعال بهذا الرقم أو البريد.');
        return;
      }
      setRoleHint(result.roleHint);
      setStep('secret');
    } catch (error) {
      setErrorMessage(cleanError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishPasswordLogin = async (loginIdentifier: string, accountSecret: string, fromSavedCard = false) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await loginWithIdentifier(loginIdentifier, accountSecret);
      const saved = saveLoginAccount(result.account, loginIdentifier, {
        passkeyEnabled: fromSavedCard ? Boolean(selectedAccount?.passkeyEnabled) : result.saved.passkeyEnabled,
      });
      refreshSaved();

      if (passkeyAvailable && !saved.passkeyEnabled) {
        setPendingAccount(saved);
        setPendingSession(result.session);
        setStep('biometric');
        return;
      }

      onLoginSuccess(result.session);
    } catch (error) {
      setErrorMessage(cleanError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSecretSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const accountSecret = secret.trim();
    if (accountSecret.length < 4) {
      setErrorMessage('أدخل رمز الحساب أو كلمة المرور.');
      return;
    }
    const loginIdentifier = selectedAccount?.identifier || identifier.trim();
    if (!loginIdentifier) {
      setErrorMessage('تعذر تحديد الحساب. أضفه مرة ثانية.');
      return;
    }
    await finishPasswordLogin(loginIdentifier, accountSecret, Boolean(selectedAccount));
  };

  const handleSavedCard = async (account: SavedLoginAccount) => {
    setSelectedAccount(account);
    setIdentifier(account.identifier);
    setRoleHint(account.role);
    setSecret('');
    setErrorMessage(null);

    if (!account.passkeyEnabled || !passkeyAvailable) {
      setStep('secret');
      return;
    }

    setBiometricBusy(true);
    try {
      const result = await loginWithPasskey(account);
      refreshSaved();
      onLoginSuccess(result.session);
    } catch (error) {
      console.warn('Passkey quick login failed; falling back to account secret:', error);
      setErrorMessage('تعذر التحقق السريع. أدخل رمز الحساب للمتابعة.');
      setStep('secret');
    } finally {
      setBiometricBusy(false);
    }
  };

  const enableBiometric = async () => {
    if (!pendingAccount || !pendingSession) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const updated = await registerPasskeyForCurrentAccount(pendingAccount);
      setPendingAccount(updated);
      refreshSaved();
      onLoginSuccess(pendingSession);
    } catch (error) {
      setErrorMessage(cleanError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueWithoutBiometric = () => {
    if (pendingSession) onLoginSuccess(pendingSession);
  };

  const visibleAccounts = useMemo(
    () => savedAccounts.filter(account => account.role === 'generator_admin' || account.role === 'collector'),
    [savedAccounts],
  );

  if (forceSuperAdmin) {
    return (
      <div className="moldatk-safe-screen min-h-screen bg-[#050b16] text-white flex items-center justify-center font-['Cairo',sans-serif]" dir="rtl">
        <div className="w-full max-w-md rounded-[32px] border border-blue-900/60 bg-[#0a1629] p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-7">
            <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-20 h-20 mx-auto object-contain bg-white rounded-3xl p-2 shadow-lg" />
            <h1 className="text-2xl font-black mt-4">بوابة السوبر أدمن</h1>
            <p className="text-xs text-slate-400 mt-2">دخول الإدارة العليا فقط</p>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute right-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={superEmail}
                onChange={event => setSuperEmail(event.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full rounded-2xl border border-slate-700 bg-[#101d31] py-3 pr-12 pl-4 outline-none focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute right-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type={showSuperPassword ? 'text' : 'password'}
                required
                value={superPassword}
                onChange={event => setSuperPassword(event.target.value)}
                placeholder="كلمة المرور"
                className="w-full rounded-2xl border border-slate-700 bg-[#101d31] py-3 pr-12 pl-12 outline-none focus:border-blue-500"
              />
              <button type="button" onClick={() => setShowSuperPassword(value => !value)} className="absolute left-4 top-3.5 text-slate-400">
                {showSuperPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button disabled={isSubmitting} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 font-black disabled:opacity-50">
              {isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="moldatk-safe-screen min-h-screen bg-[#030a14] text-white font-['Cairo',sans-serif] overflow-x-hidden" dir="rtl">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-[-220px] right-[-120px] w-[480px] h-[480px] rounded-full bg-[#123a73]/25 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-44 opacity-30 bg-[radial-gradient(circle_at_30%_100%,#174b87_0,transparent_52%),radial-gradient(circle_at_80%_100%,#0b2748_0,transparent_46%)]" />
      </div>

      <main className="relative z-10 w-full max-w-md mx-auto min-h-[100dvh] flex flex-col px-4 sm:px-5 pt-8 pb-7">
        <section className="text-center">
          <img src="/brand/moldatk-mark.svg" alt="شعار مولدتك" className="w-20 h-20 mx-auto object-contain bg-white rounded-[26px] p-2 shadow-[0_14px_40px_rgba(30,100,255,0.2)]" />
          <div className="text-3xl font-black mt-3 tracking-tight">مولدتك</div>
          <div className="text-xs text-slate-400 mt-1">إدارة أسهل .. لحياة أريح</div>
        </section>

        {step === 'accounts' && (
          <>
            <section className="text-center mt-9 mb-6">
              <h1 className="text-3xl font-black">اختر حسابك</h1>
              <p className="text-sm text-slate-400 mt-2">اضغط على البطاقة لتسجيل الدخول بسرعة</p>
            </section>

            <div className="space-y-3">
              {visibleAccounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => void handleSavedCard(account)}
                  disabled={biometricBusy}
                  className="group w-full text-right rounded-[26px] border border-slate-700/80 bg-[#0d192a]/95 hover:border-blue-400 active:scale-[0.99] transition-all px-4 py-4 shadow-[0_14px_35px_rgba(0,0,0,0.28)] disabled:opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#162943] border border-blue-900/60 flex items-center justify-center shrink-0">
                      {account.role === 'collector'
                        ? <UserRound className="w-9 h-9 text-blue-300" />
                        : <Factory className="w-9 h-9 text-blue-300" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xl font-black truncate">{account.generatorName}</div>
                      {account.role === 'collector' ? (
                        <div className="text-sm text-slate-400 mt-1 truncate">تابع لـ {account.ownerName}</div>
                      ) : account.location ? (
                        <div className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="truncate">{account.location}</span>
                        </div>
                      ) : null}
                      <span className={`inline-flex mt-2 rounded-full px-3 py-1 text-[11px] font-black ${
                        account.role === 'collector'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {roleLabel(account.role)}
                      </span>
                    </div>

                    <ChevronLeft className="w-6 h-6 text-slate-300 group-hover:text-blue-300 shrink-0" />
                  </div>
                </button>
              ))}

              {biometricBusy && (
                <div className="rounded-[26px] border border-blue-500/40 bg-[#0c192b] p-5 text-center">
                  <Fingerprint className="w-14 h-14 mx-auto text-blue-400 animate-pulse" />
                  <div className="font-black mt-3">تأكيد الدخول</div>
                  <div className="text-xs text-slate-400 mt-1">استخدم Face ID أو بصمة الجهاز</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('identifier');
                  setIdentifier('');
                  setRoleHint(undefined);
                  setSecret('');
                  setErrorMessage(null);
                }}
                className="w-full rounded-[24px] border border-blue-500/50 bg-[#0c1a2f]/80 hover:bg-[#10223d] py-4 flex items-center justify-center gap-2 text-blue-300 font-black"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة حساب آخر</span>
              </button>
            </div>

            {visibleAccounts.length === 0 && (
              <div className="mt-4 text-center text-xs text-slate-500">أضف حسابك مرة واحدة، وبعدها يظهر هنا للدخول السريع.</div>
            )}

            <div className="mt-auto pt-10 text-center text-[11px] text-slate-500 space-y-3">
              <div>دخول آمن • لا يتم حفظ كلمة المرور أو رمز الحساب</div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <a href="/privacy" className="hover:text-blue-300">الخصوصية</a>
                <span>•</span>
                <a href="/terms" className="hover:text-blue-300">الشروط</a>
                <span>•</span>
                <a href="/delete-account" className="hover:text-rose-300">حذف الحساب</a>
              </div>
            </div>
          </>
        )}

        {(step === 'identifier' || step === 'secret') && (
          <section className="mt-8">
            <button type="button" onClick={resetAddFlow} className="inline-flex items-center gap-1 text-sm text-blue-300 mb-6">
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>الحسابات</span>
            </button>

            <div className="rounded-[30px] border border-slate-700/80 bg-[#0c1728]/95 p-5 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 flex items-center justify-center mx-auto">
                  {step === 'identifier' ? <Smartphone className="w-7 h-7 text-blue-300" /> : <LockKeyhole className="w-7 h-7 text-blue-300" />}
                </div>
                <h2 className="text-xl font-black mt-3">
                  {selectedAccount ? selectedAccount.generatorName : step === 'identifier' ? 'إضافة حساب جديد' : 'تأكيد الحساب'}
                </h2>
                <p className="text-xs text-slate-400 mt-2">
                  {step === 'identifier'
                    ? 'أدخل رقم الهاتف أو البريد الإلكتروني'
                    : `${roleLabel(roleHint)} • أدخل رمز الحساب للمتابعة`}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {step === 'identifier' ? (
                <form onSubmit={handleDiscover} className="space-y-4">
                  <input
                    autoFocus
                    type="text"
                    inputMode="email"
                    value={identifier}
                    onChange={event => setIdentifier(event.target.value)}
                    placeholder="رقم الهاتف أو البريد الإلكتروني"
                    className="w-full rounded-2xl border border-slate-700 bg-[#111f33] px-4 py-3.5 text-center outline-none focus:border-blue-500 placeholder:text-slate-500"
                  />
                  <button disabled={isSubmitting} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isSubmitting ? 'جاري البحث...' : 'متابعة'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSecretSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      autoFocus
                      type={showSecret ? 'text' : 'password'}
                      inputMode={roleHint === 'collector' ? 'numeric' : 'text'}
                      value={secret}
                      onChange={event => setSecret(event.target.value)}
                      placeholder={roleHint === 'collector' ? 'رمز الجابي' : 'رمز الحساب أو كلمة المرور'}
                      className="w-full rounded-2xl border border-slate-700 bg-[#111f33] px-12 py-3.5 text-center outline-none focus:border-blue-500 placeholder:text-slate-500"
                    />
                    <button type="button" onClick={() => setShowSecret(value => !value)} className="absolute left-4 top-3.5 text-slate-400">
                      {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <button disabled={isSubmitting} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {step === 'biometric' && pendingAccount && (
          <section className="mt-10 rounded-[30px] border border-blue-500/30 bg-[#0b1728] p-6 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-400/40 flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(59,130,246,0.2)]">
              <Fingerprint className="w-12 h-12 text-blue-300" />
            </div>
            <h2 className="text-2xl font-black mt-5">تفعيل الدخول السريع؟</h2>
            <p className="text-sm text-slate-400 leading-7 mt-2">
              من المرة الجاية اضغط على بطاقة {pendingAccount.generatorName} فقط، والجهاز يتأكد بالبصمة أو Face ID.
            </p>

            {errorMessage && (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={() => void enableBiometric()}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 font-black mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
              <span>{isSubmitting ? 'جاري التفعيل...' : 'تفعيل Face ID / البصمة'}</span>
            </button>
            <button type="button" onClick={continueWithoutBiometric} className="w-full py-3 mt-2 text-sm font-bold text-slate-400">
              لاحقاً
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

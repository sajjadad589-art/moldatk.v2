import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  Zap, 
  Eye, 
  EyeOff, 
  AlertCircle,
  KeyRound,
  Sparkles,
  Phone
} from 'lucide-react';
import { Collector, UserRole, ActiveUserSession } from '../types';
import { supabase } from '../lib/supabase';

interface LoginViewProps {
  collectors: Collector[];
  onLoginSuccess: (session: ActiveUserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ collectors, onLoginSuccess }) => {
  const [role, setRole] = useState<UserRole>('admin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    if (role === 'admin') {
      setIsSubmitting(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanInput,
          password: cleanPass,
        });

        if (error || !data.user) {
          setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, generator_id, is_active')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setErrorMessage('الحساب غير مربوط بصلاحيات النظام');
          return;
        }

        if (!profile.is_active) {
          await supabase.auth.signOut();
          setErrorMessage('هذا الحساب موقوف حالياً');
          return;
        }

        if (profile.role !== 'super_admin' && profile.role !== 'generator_admin') {
          await supabase.auth.signOut();
          setErrorMessage('هذا الحساب غير مخول للدخول كتطبيق مالك مولدة');
          return;
        }

        onLoginSuccess({
          role: profile.role,
          email: data.user.email || cleanInput,
          username: data.user.email || cleanInput,
          generatorId: profile.generator_id,
          loginTime: new Date().toISOString(),
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const collector = collectors.find(c => c.phone.trim() === cleanInput && (c.passcode || '1234').trim() === cleanPass);

      if (collector) {
        onLoginSuccess({
          role: 'collector',
          collectorId: collector.id,
          collectorName: collector.name,
          generatorId: collector.generatorId || null,
          loginTime: new Date().toISOString(),
        });
      } else {
        setErrorMessage('رقم الهاتف أو الرمز السري للجابي غير صحيح');
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-100 dark:bg-[#070d1e] font-['Cairo',sans-serif] transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#111c38] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto bg-[#1E3A8A] text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-900/30">
            <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مولدتك</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            منظومة إدارة المولدات والاشتراكات
          </p>
        </div>

        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setRole('admin'); setErrorMessage(null); setUsernameInput(''); setPasswordInput(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              role === 'admin'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>صاحب المولد</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setRole('collector'); setErrorMessage(null); setUsernameInput(''); setPasswordInput(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              role === 'collector'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-blue-300" />
            <span>جابي / كادر</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {role === 'admin' ? 'البريد الإلكتروني' : 'رقم الهاتف (يوزر الجابي)'}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type={role === 'admin' ? 'email' : 'text'}
                required
                placeholder={role === 'admin' ? 'name@example.com' : '07800000000'}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 font-bold font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {role === 'admin' ? 'كلمة المرور' : 'الرمز السري (PIN)'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={role === 'admin' ? '••••••' : 'رمز الدخول'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-60 text-white font-bold text-xs shadow-lg shadow-blue-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span>{isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول للنظام'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          دخول الإدارة العليا أصبح مرتبطاً بـ Supabase Authentication
        </div>
      </div>
    </div>
  );
};
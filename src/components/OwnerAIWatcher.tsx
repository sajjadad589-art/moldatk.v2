import React from 'react';
import { AlertTriangle, Bot, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Issue = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: string;
  detected_at: string;
};

const LAST_SEEN_KEY = 'moldatk_owner_ai_last_seen_issue';

export const OwnerAIWatcher: React.FC<{ onOpenAssistant: () => void }> = ({ onOpenAssistant }) => {
  const [issue, setIssue] = React.useState<Issue | null>(null);

  React.useEffect(() => {
    let disposed = false;
    const check = async () => {
      const { data, error } = await supabase
        .from('owner_ai_issues')
        .select('id,severity,title,details,detected_at')
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (disposed || error || !data) return;
      let lastSeen = '';
      try { lastSeen = localStorage.getItem(LAST_SEEN_KEY) || ''; } catch {}
      if (data.id !== lastSeen) setIssue(data as Issue);
    };
    void check();
    const timer = window.setInterval(() => void check(), 45_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const dismiss = () => {
    if (issue) {
      try { localStorage.setItem(LAST_SEEN_KEY, issue.id); } catch {}
    }
    setIssue(null);
  };

  if (!issue) return null;

  return (
    <div dir="rtl" className="fixed z-[160] right-3 left-3 sm:right-auto sm:left-5 bottom-24 sm:bottom-6 sm:w-[390px] rounded-[22px] border border-amber-300/40 dark:border-amber-800/60 bg-white/95 dark:bg-[#111c38]/95 backdrop-blur-xl shadow-2xl p-4">
      <button onClick={dismiss} className="absolute left-3 top-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
      <div className="flex items-start gap-3 pl-7">
        <div className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center ${issue.severity === 'critical' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'}`}>
          {issue.severity === 'critical' ? <AlertTriangle className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 dark:text-blue-300"><Sparkles className="w-3.5 h-3.5" /> مساعد مولدتك لاحظ شي يحتاج انتباهك</div>
          <div className="font-black text-sm text-slate-900 dark:text-white mt-1">{issue.title}</div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-5 mt-1 line-clamp-3">{issue.details}</div>
          <button onClick={() => { dismiss(); onOpenAssistant(); }} className="mt-3 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2">
            <Bot className="w-4 h-4" /> افتح المساعد وراجعها
          </button>
        </div>
      </div>
    </div>
  );
};

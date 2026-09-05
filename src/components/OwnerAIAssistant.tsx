import React from 'react';
import { Bot, CheckCircle2, FileSpreadsheet, Loader2, Send, Sparkles, Upload, X, AlertTriangle, History, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Issue = { id:string; severity:'info'|'warning'|'critical'; title:string; details:string; status:string; detected_at:string };

export const OwnerAIAssistant: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { role:'assistant', content:'هلا بيك. أني مساعد مولدتك AI. اكدر أعدل التسعيرة الحالية، أقرأ Excel وأضيف المشتركين، أفحص الأخطاء الآمنة، وأعطيك ملخص الجباية والديون. احچي وياي طبيعي.' }
  ]);
  const [busy, setBusy] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [fileRows, setFileRows] = React.useState<any[]>([]);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [fileBusy, setFileBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const loadIssues = React.useCallback(async () => {
    const { data } = await supabase
      .from('owner_ai_issues')
      .select('id,severity,title,details,status,detected_at')
      .eq('status','open')
      .order('detected_at',{ ascending:false })
      .limit(6);
    if (Array.isArray(data)) setIssues(data as Issue[]);
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadIssues();
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, loadIssues]);

  const parseExcel = async (file: File) => {
    setFileBusy(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type:'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval:'', raw:false });
      setFileRows(rows as any[]);
      setFileName(file.name);
      setMessages(prev => [...prev, { role:'assistant', content:`قريت الملف «${file.name}» وبي ${rows.length} صف. اكتبلي مثلاً «ضيف المشتركين» حتى أنفذ، أو اسألني شنو فهمت من الملف.` }]);
    } catch (e:any) {
      setMessages(prev => [...prev, { role:'assistant', content:e?.message || 'ما كدرت أقرأ ملف Excel. تأكد أنه xlsx أو xls.' }]);
    } finally {
      setFileBusy(false);
    }
  };

  const send = async (override?: string) => {
    const text = String(override ?? input).trim();
    if ((!text && !fileRows.length) || busy) return;
    if (text) setMessages(prev => [...prev, { role:'user', content:text }]);
    setInput('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-ai-agent', {
        body: {
          message:text || 'اقرأ الملف وقللي شنو بيه',
          session_id:sessionId,
          file_name:fileName || undefined,
          file_rows:fileRows.length ? fileRows : undefined,
        }
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'تعذر تنفيذ الأمر');
      if (data.session_id) setSessionId(data.session_id);
      setMessages(prev => [...prev, { role:'assistant', content:String(data.answer || 'تم.') }]);
      if (data?.action?.type === 'import_subscribers_excel') {
        setFileRows([]);
        setFileName('');
        window.dispatchEvent(new Event('moldatk-local-sync'));
      }
      if (data?.action) window.dispatchEvent(new Event('moldatk-local-sync'));
      void loadIssues();
    } catch (e:any) {
      setMessages(prev => [...prev, { role:'assistant', content:e?.message || 'صار خلل بتنفيذ الأمر.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact
          ? 'w-full rounded-2xl bg-gradient-to-l from-violet-600 to-blue-600 text-white px-4 py-4 flex items-center justify-between gap-3 shadow-lg shadow-blue-900/15'
          : 'w-full rounded-[22px] bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 text-white px-5 py-5 flex items-center justify-between gap-4 shadow-xl shadow-blue-900/20 ring-1 ring-white/10'}
      >
        <div className="flex items-center gap-3 text-right">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Bot className="w-6 h-6" /></div>
          <div>
            <div className="font-black text-base">مساعد مولدتك AI</div>
            <div className="text-[11px] text-white/75 mt-1">احچي وياه وهو ينفذ أوامرك داخل حسابك</div>
          </div>
        </div>
        <Sparkles className="w-6 h-6 shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="w-full sm:max-w-2xl h-[92vh] sm:h-[82vh] rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-[#0d1730] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-l from-violet-600/10 to-blue-600/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-l from-violet-600 to-blue-600 text-white flex items-center justify-center"><Bot className="w-5 h-5" /></div>
                <div><div className="font-black text-slate-900 dark:text-white">مساعد مولدتك AI</div><div className="text-[11px] text-slate-500 dark:text-slate-400">تنفيذ أوامر + Excel + فحص أخطاء</div></div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>

            {issues.length > 0 && (
              <div className="px-4 pt-3">
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300"><AlertTriangle className="w-4 h-4"/> عندك {issues.length} ملاحظة تحتاج انتباه</div>
                  <div className="text-[11px] text-amber-700/80 dark:text-amber-200/70 mt-1 truncate">{issues[0].title}</div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m,i) => (
                <div key={i} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${m.role==='user' ? 'mr-auto bg-blue-600 text-white rounded-br-md' : 'ml-auto bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md'}`}>{m.content}</div>
              ))}
              {busy && <div className="ml-auto inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin"/> دا أنفذ الأمر...</div>}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-white dark:bg-[#0d1730]">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {['شكد باقي جباية؟','افحص الأخطاء وصحح الآمن','شنو أگدر أطلب منك؟'].map(q => <button key={q} onClick={() => void send(q)} className="shrink-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">{q}</button>)}
              </div>

              {fileName && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-3 py-2 flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><FileSpreadsheet className="w-4 h-4"/>{fileName} — {fileRows.length} صف</span><button onClick={() => {setFileName('');setFileRows([]);}}><X className="w-4 h-4"/></button></div>}

              <div className="flex gap-2 items-end">
                <label className="w-12 h-12 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer" title="إرفاق Excel">
                  {fileBusy ? <Loader2 className="w-5 h-5 animate-spin"/> : <Upload className="w-5 h-5"/>}
                  <input type="file" accept=".xlsx,.xls" className="hidden" disabled={fileBusy || busy} onChange={e => { const f=e.target.files?.[0]; if(f) void parseExcel(f); e.currentTarget.value=''; }} />
                </label>
                <input ref={inputRef} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void send();}}} placeholder="مثلاً: خلي سعر العادي 12000" className="flex-1 min-h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 text-sm outline-none focus:border-blue-500" />
                <button disabled={busy || (!input.trim() && !fileRows.length)} onClick={() => void send()} className="w-12 h-12 shrink-0 rounded-2xl bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center"><Send className="w-5 h-5"/></button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400"><ShieldCheck className="w-3.5 h-3.5"/> المساعد ما يغير دين أو تسديد تاريخي من نفسه، وكل تنفيذ ينحفظ بالسجل.</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

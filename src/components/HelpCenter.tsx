import React from 'react';
import { BookOpen, ChevronLeft, ChevronRight, CirclePlay, Clock3, HelpCircle, Loader2, Pause, Play, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tutorial = {
  id:string; slug:string; title:string; description?:string|null; category:string; video_url?:string|null; thumbnail_url?:string|null; duration_seconds?:number|null; sort_order:number; steps?:Array<{title:string;text:string}>;
};

export const HelpCenter: React.FC = () => {
  const [open,setOpen] = React.useState(false);
  const [loading,setLoading] = React.useState(false);
  const [items,setItems] = React.useState<Tutorial[]>([]);
  const [selected,setSelected] = React.useState<Tutorial|null>(null);
  const [step,setStep] = React.useState(0);
  const [playing,setPlaying] = React.useState(true);

  const load = React.useCallback(async () => {
    if (items.length) return;
    setLoading(true);
    const { data } = await supabase.from('help_tutorials').select('id,slug,title,description,category,video_url,thumbnail_url,duration_seconds,sort_order,steps').eq('is_active',true).order('sort_order');
    if (Array.isArray(data)) setItems(data as Tutorial[]);
    setLoading(false);
  },[items.length]);

  React.useEffect(()=>{ if(open) void load(); },[open,load]);
  React.useEffect(()=>{
    if(!selected || selected.video_url || !playing || !selected.steps?.length) return;
    const timer = window.setInterval(()=> setStep(s => (s+1) % selected.steps!.length), 3800);
    return ()=>window.clearInterval(timer);
  },[selected,playing]);

  const openTutorial = (t:Tutorial) => { setSelected(t); setStep(0); setPlaying(true); };
  const currentStep = selected?.steps?.[step];

  return <>
    <button onClick={()=>setOpen(true)} type="button" className="w-full rounded-[22px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] px-5 py-4 flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3 text-right">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center"><BookOpen className="w-5 h-5"/></div>
        <div><div className="font-black text-sm text-slate-900 dark:text-white">مركز المساعدات</div><div className="text-[10px] text-slate-400 mt-1">دروس قصيرة متحركة وخفيفة بدون تحميل ثقيل</div></div>
      </div>
      <ChevronLeft className="w-5 h-5 text-slate-400"/>
    </button>

    {open && <div className="fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="w-full sm:max-w-3xl h-[92vh] sm:h-[84vh] rounded-t-[28px] sm:rounded-[28px] bg-slate-50 dark:bg-[#0d1730] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#111c38]">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><HelpCircle className="w-5 h-5"/></div><div><div className="font-black text-slate-900 dark:text-white">مركز مساعدات مولدتك</div><div className="text-[10px] text-slate-400">تعلم أي خطوة خلال أقل من دقيقة</div></div></div>
          <button onClick={()=>{setOpen(false);setSelected(null);}} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            loading ? <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div> :
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((t,i)=><button key={t.id} onClick={()=>openTutorial(t)} className="text-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] p-4 hover:border-emerald-400/50 transition-all">
                <div className="flex items-start gap-3"><div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-emerald-500 flex items-center justify-center shrink-0"><CirclePlay className="w-5 h-5"/></div><div className="min-w-0"><div className="font-black text-sm text-slate-900 dark:text-white">{i+1}. {t.title}</div><div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-5">{t.description}</div><div className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-300"><Clock3 className="w-3.5 h-3.5"/> درس قصير</div></div></div>
              </button>)}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <button onClick={()=>setSelected(null)} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ChevronRight className="w-4 h-4"/> رجوع للدروس</button>
              <div className="rounded-[26px] overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] shadow-xl">
                {selected.video_url ? (
                  <video src={selected.video_url} controls preload="none" poster={selected.thumbnail_url || undefined} className="w-full aspect-video bg-black" />
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -left-12 -top-12 w-44 h-44 rounded-full bg-blue-500/20 blur-3xl"/>
                    <div className="relative flex items-center justify-between"><span className="text-xs font-black text-emerald-300">مولدتك • شرح سريع</span><span className="text-xs text-white/50">{step+1}/{selected.steps?.length || 1}</span></div>
                    <div className="relative text-center px-3"><div className="mx-auto w-16 h-16 rounded-[22px] bg-white/10 border border-white/10 flex items-center justify-center mb-5"><BookOpen className="w-8 h-8 text-emerald-300"/></div><h3 className="text-xl sm:text-2xl font-black">{currentStep?.title || selected.title}</h3><p className="text-sm sm:text-base text-white/70 leading-7 mt-3">{currentStep?.text || selected.description}</p></div>
                    <div className="relative flex items-center gap-2">{(selected.steps || []).map((_,i)=><button key={i} onClick={()=>setStep(i)} className={`h-1.5 rounded-full flex-1 transition-all ${i===step?'bg-emerald-400':'bg-white/20'}`}/>)}</div>
                  </div>
                )}

                <div className="p-4 flex items-center justify-between gap-3">
                  <div><div className="font-black text-slate-900 dark:text-white">{selected.title}</div><div className="text-[11px] text-slate-400 mt-1">{selected.video_url ? 'الفيديو ما يتحمل إلا من تضغط تشغيل' : 'مشاهد تعليمية متحركة خفيفة داخل التطبيق'}</div></div>
                  {!selected.video_url && <div className="flex items-center gap-2"><button onClick={()=>setStep(s=>Math.max(0,s-1))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ChevronRight className="w-4 h-4"/></button><button onClick={()=>setPlaying(p=>!p)} className="p-2.5 rounded-xl bg-emerald-500 text-white">{playing?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button><button onClick={()=>setStep(s=>Math.min((selected.steps?.length||1)-1,s+1))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ChevronLeft className="w-4 h-4"/></button></div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>}
  </>;
};

import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const assistantPath = 'src/components/CustomerOrderAssistant.tsx';
let src = read(assistantPath);
if (src) {
  if (!src.includes("const SALES_SESSION_KEY = 'moldatk_sales_agent_session';")) {
    src = src.replace(
      "const TRACKING_KEY = 'moldatk_customer_order_tracking';",
      "const TRACKING_KEY = 'moldatk_customer_order_tracking';\nconst SALES_SESSION_KEY = 'moldatk_sales_agent_session';"
    );
  }

  if (!src.includes('const [agentBusy, setAgentBusy]')) {
    src = src.replace(
      "  const [qa, setQa] = useState<Array<{ who: 'user' | 'agent'; text: string }>>([]);",
      "  const [qa, setQa] = useState<Array<{ who: 'user' | 'agent'; text: string }>>([]);\n  const [agentBusy, setAgentBusy] = useState(false);"
    );
  }

  const start = src.indexOf('  const askAgent = () => {');
  if (start >= 0) {
    const end = src.indexOf('\n  };', start);
    if (end >= 0) {
      const next = String.raw`  const askAgent = async () => {
    const q = question.trim();
    if (!q || agentBusy) return;
    setQuestion('');
    setQa(prev => [...prev, { who: 'user', text: q }].slice(-16));
    setAgentBusy(true);
    try {
      let sessionToken = localStorage.getItem(SALES_SESSION_KEY) || '';
      if (!sessionToken) {
        sessionToken = crypto.randomUUID();
        localStorage.setItem(SALES_SESSION_KEY, sessionToken);
      }
      const { data, error } = await supabase.functions.invoke('sales-agent-ai', {
        body: {
          action: 'chat',
          session_token: sessionToken,
          message: q,
          mode,
          stage,
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'تعذر الوصول للمساعد الذكي');
      setQa(prev => [...prev, { who: 'agent', text: String(data.answer || 'اكتبلي سؤالك بطريقة ثانية حتى أساعدك أدق.') }].slice(-16));
    } catch (e: any) {
      setQa(prev => [...prev, { who: 'agent', text: e?.message || 'صار خلل مؤقت بالمساعد. تقدر تكمل الطلب من الخطوات الظاهرة.' }].slice(-16));
    } finally {
      setAgentBusy(false);
    }
  };`;
      src = src.slice(0, start) + next + src.slice(end + '\n  };'.length);
    }
  }

  src = src.replace(
    '<p className="text-xs text-slate-400 mt-1">طلب جديد أو تجديد — من المحادثة إلى التفعيل</p>',
    '<p className="text-xs text-slate-400 mt-1">محادثة AI حقيقية — تسأل، تختار، وتكمل الطلب إلى التفعيل</p>'
  );

  src = src.replace(
    '<div className="flex items-center gap-2 mb-3 text-xs text-slate-400"><Zap className="w-4 h-4 text-amber-300"/> عندك سؤال قبل ما تكمل؟ احچي وياي.</div>',
    '<div className="flex items-center gap-2 mb-3 text-xs text-slate-400"><Zap className="w-4 h-4 text-amber-300"/> عندك سؤال؟ احچي ويا المساعد الذكي بصورة طبيعية، مو ردود محفوظة.</div>'
  );

  src = src.replace(
    '<div className="flex gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\'){e.preventDefault();askAgent();}}} placeholder="مثلاً: شنو الباقة الأوفر؟" className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 text-sm"/><button onClick={askAgent} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Send className="w-4 h-4"/></button></div>',
    '<div className="flex gap-2"><input value={question} disabled={agentBusy} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\'){e.preventDefault();void askAgent();}}} placeholder="اسألني بأي صيغة... مثلاً: ليش آخذ السنوي؟" className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 text-sm disabled:opacity-60"/><button disabled={agentBusy || !question.trim()} onClick={() => void askAgent()} className="w-14 h-14 rounded-2xl bg-amber-400 disabled:opacity-50 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-950/20">{agentBusy?<Loader2 className="w-5 h-5 animate-spin"/>:<Send className="w-5 h-5"/>}</button></div>'
  );

  write(assistantPath, src);
}

const landingPath = 'src/LandingPage.tsx';
let landing = read(landingPath);
if (landing) {
  if (!landing.includes('const orderUrl =')) {
    landing = landing.replace(
      "  const appUrl = `${window.location.origin}/`;",
      "  const appUrl = `${window.location.origin}/`;\n  const orderUrl = `${window.location.origin}/order`;"
    );
  }

  const oldHeroActions = String.raw`            <div className="flex flex-wrap gap-3">
              <a href={appUrl} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black hover:bg-amber-300 transition-all">
                فتح النظام الآن <ArrowLeft className="w-5 h-5" />
              </a>
              <a href="#release" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black hover:bg-white/15 transition-all">
                <Download className="w-5 h-5" /> نسخة Android
              </a>
            </div>`;
  const newHeroActions = String.raw`            <div className="space-y-3">
              <a href={orderUrl} className="group w-full sm:w-auto min-w-[290px] inline-flex items-center justify-center gap-3 px-8 py-5 rounded-[1.35rem] bg-amber-400 text-slate-950 text-lg sm:text-xl font-black hover:bg-amber-300 hover:-translate-y-0.5 transition-all shadow-2xl shadow-amber-950/30 ring-4 ring-amber-400/10">
                <Zap className="w-6 h-6" /> اطلب اشتراك مولدتك الآن <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
              </a>
              <div className="flex flex-wrap gap-3">
                <a href={appUrl} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black hover:bg-white/15 transition-all">
                  دخول المشتركين <ArrowLeft className="w-5 h-5" />
                </a>
                <a href="#release" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black hover:bg-white/15 transition-all">
                  <Download className="w-5 h-5" /> نسخة Android
                </a>
              </div>
            </div>`;
  if (landing.includes(oldHeroActions)) landing = landing.replace(oldHeroActions, newHeroActions);

  if (!landing.includes('href={orderUrl} className="hidden sm:inline-flex')) {
    const loginButton = '<a href={appUrl} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-bold transition-all shrink-0">';
    landing = landing.replace(
      loginButton,
      '<div className="flex items-center gap-2"><a href={orderUrl} className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-black hover:bg-amber-300 transition-all shadow-lg"><Zap className="w-4 h-4"/> اطلب الآن</a>' + loginButton
    );
    landing = landing.replace(
      'دخول النظام <ArrowLeft className="w-4 h-4" />\n          </a>\n        </div>\n      </header>',
      'دخول النظام <ArrowLeft className="w-4 h-4" />\n          </a></div>\n        </div>\n      </header>'
    );
  }

  write(landingPath, landing);
}

const finalAssistant = read(assistantPath);
const finalLanding = read(landingPath);
if (!finalAssistant.includes("supabase.functions.invoke('sales-agent-ai'")) throw new Error('AI sales agent invoke missing');
if (!finalAssistant.includes('agentBusy')) throw new Error('AI sales agent loading state missing');
if (!finalLanding.includes('اطلب اشتراك مولدتك الآن')) throw new Error('Prominent order CTA missing');
console.log('Sales agent AI memory and prominent order CTA applied.');

import React from 'react';
import {
  Zap,
  Smartphone,
  Apple,
  Monitor,
  ShieldCheck,
  RefreshCw,
  Database,
  ReceiptText,
  Users,
  Download,
  ArrowLeft,
  CheckCircle2,
  Share2,
  PlusSquare,
  Wifi,
  LockKeyhole,
  Layers3,
  BadgeCheck,
  HelpCircle,
  ChevronDown,
  Globe2,
} from 'lucide-react';

const features = [
  { icon: Database, title: 'بياناتك بكل مكان', text: 'نفس الحساب ونفس البيانات على Android وiPhone والكمبيوتر.' },
  { icon: ReceiptText, title: 'جباية وفواتير', text: 'تسديدات، إيصالات وسجل فواتير مرتبط مباشرة بالمولدة.' },
  { icon: Users, title: 'إدارة الجباة', text: 'حسابات وصلاحيات لكل جابي مع مزامنة مركزية.' },
  { icon: RefreshCw, title: 'تحديثات Android', text: 'التطبيق يتحقق من الإصدار الجديد ويعرض التحديث من داخل التطبيق.' },
  { icon: ShieldCheck, title: 'حماية وعزل البيانات', text: 'كل مولدة تشوف بياناتها فقط من خلال نظام صلاحيات مركزي.' },
  { icon: Smartphone, title: 'مصمم للموبايل', text: 'واجهة عملية لأجهزة SUNMI والهواتف والأجهزة اللوحية.' },
];

const faq = [
  ['هل أحتاج حساب مختلف لكل جهاز؟', 'لا. تدخل بنفس الحساب وتشوف نفس بيانات المولدة من أي جهاز مسموح له بالدخول.'],
  ['هل نسخة iPhone تحتاج App Store؟', 'لا. تفتح مولدتك من Safari وتضيفه إلى الشاشة الرئيسية كتطبيق ويب مصغّر.'],
  ['هل البيانات تبقى فقط على الجهاز؟', 'لا. البيانات التشغيلية الأساسية مربوطة بقاعدة بيانات مركزية حتى تظل موحّدة بين الأجهزة.'],
  ['هل Android يحتاج Google Play؟', 'لا. نسخة Android مصممة حتى تُثبت مباشرة، ونظام التحديث الداخلي يقدر يتحقق من الإصدارات الجديدة.'],
  ['هل الجابي يشوف كل إعدادات النظام؟', 'لا. صلاحيات الجابي منفصلة ويمكن التحكم بما يستطيع مشاهدته أو تنفيذه.'],
];

const iphoneSteps = [
  { icon: Globe2, title: '1. افتح مولدتك بـ Safari', text: 'افتح رابط النظام من متصفح Safari على iPhone.' },
  { icon: Share2, title: '2. اضغط مشاركة', text: 'من شريط Safari اضغط زر المشاركة.' },
  { icon: PlusSquare, title: '3. إضافة إلى الشاشة الرئيسية', text: 'اختار Add to Home Screen حتى يظهر مولدتك مثل أي تطبيق.' },
  { icon: BadgeCheck, title: '4. سجل دخولك', text: 'ادخل بنفس الحساب وستظهر بياناتك المتزامنة مباشرة.' },
];

export default function LandingPage() {
  const appUrl = `${window.location.origin}/`;

  return (
    <div dir="rtl" className="min-h-screen bg-[#071126] text-white font-['Cairo',sans-serif] selection:bg-blue-500 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071126]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
              <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <div className="font-black text-lg">مولدتك</div>
              <div className="text-[11px] text-slate-400">Moldatk</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-xs font-bold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">المزايا</a>
            <a href="#platforms" className="hover:text-white transition-colors">الأجهزة</a>
            <a href="#iphone" className="hover:text-white transition-colors">iPhone</a>
            <a href="#release" className="hover:text-white transition-colors">الإصدار</a>
            <a href="#faq" className="hover:text-white transition-colors">الأسئلة</a>
          </nav>

          <a href={appUrl} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-bold transition-all shrink-0">
            دخول النظام <ArrowLeft className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main id="top">
        <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/15 border border-blue-500/20 text-blue-300 text-xs font-bold">
              <Wifi className="w-4 h-4" /> نظام واحد لكل أجهزتك
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.2]">
              إدارة المولدة والجباية<br/><span className="text-blue-400">من أي جهاز</span>
            </h1>
            <p className="text-slate-300 leading-8 max-w-xl text-sm sm:text-base">
              مولدتك يجمع المشتركين، التسديدات، الفواتير، الجباة والإعدادات في نظام واحد. استخدمه على Android أو iPhone أو الكمبيوتر بدون ما تنفصل بياناتك بين جهاز وجهاز.
            </p>

            <div className="flex flex-wrap gap-3">
              <a href={appUrl} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 font-black hover:bg-slate-100 transition-all">
                فتح النظام الآن <ArrowLeft className="w-5 h-5" />
              </a>
              <a href="#release" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600/15 border border-blue-500/20 text-blue-200 font-black hover:bg-blue-600/20 transition-all">
                <Download className="w-5 h-5" /> نسخة Android
              </a>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> مزامنة مركزية</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> صلاحيات منفصلة</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> دعم SUNMI</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-blue-600/10 blur-3xl rounded-full" />
            <div className="relative bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[['Android', Smartphone], ['iPhone', Apple], ['Computer', Monitor]].map(([name, Icon]: any) => (
                  <div key={name} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                    <Icon className="w-7 h-7 mx-auto mb-2 text-blue-300" />
                    <div className="text-xs font-bold">{name}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-[#0b1731] border border-white/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">حالة البيانات</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-black"><span className="w-2 h-2 rounded-full bg-emerald-400" /> متصلة</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">المشتركون</div><div className="font-black text-xl mt-1">Cloud</div></div>
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">التسديدات</div><div className="font-black text-xl mt-1">Realtime</div></div>
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">الجباة</div><div className="font-black text-xl mt-1">Secure</div></div>
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">الفواتير</div><div className="font-black text-xl mt-1">Shared</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-y border-white/10 bg-white/[0.025]">
          <div className="max-w-6xl mx-auto px-5 py-20">
            <div className="max-w-2xl mx-auto text-center mb-11">
              <span className="text-blue-300 text-xs font-black">كل شغلك بمكان واحد</span>
              <h2 className="text-2xl sm:text-3xl font-black mt-2">مزايا مولدتك</h2>
              <p className="text-slate-400 text-sm leading-7 mt-3">مصمم حتى يقلل التكرار ويخلي صاحب المولدة والجابي يشتغلون على نفس المعلومات.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/[0.07] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-blue-300" /></div>
                  <h3 className="font-black mb-2">{title}</h3>
                  <p className="text-sm leading-6 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="platforms" className="scroll-mt-24 max-w-6xl mx-auto px-5 py-20">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3 mb-5 text-center">
              <h2 className="text-2xl sm:text-3xl font-black">اختار الجهاز اللي يناسبك</h2>
              <p className="text-slate-400 text-sm mt-3">كلهم يوصلون لنفس الحساب ونفس قاعدة البيانات.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <Smartphone className="w-9 h-9 text-blue-300 mb-5" />
              <h3 className="text-lg font-black">Android</h3>
              <p className="text-sm text-slate-400 leading-7 mt-2">تطبيق مخصص لأجهزة Android وSUNMI مع دعم الخصائص الأصلية مثل الطباعة والتحديث.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <Apple className="w-9 h-9 text-blue-300 mb-5" />
              <h3 className="text-lg font-black">iPhone</h3>
              <p className="text-sm text-slate-400 leading-7 mt-2">نسخة ويب مصغّرة تنضاف إلى الشاشة الرئيسية وتفتح كتطبيق مستقل من Safari.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <Monitor className="w-9 h-9 text-blue-300 mb-5" />
              <h3 className="text-lg font-black">الكمبيوتر</h3>
              <p className="text-sm text-slate-400 leading-7 mt-2">لوحة تحكم كاملة من المتصفح لمتابعة المشتركين والجباية والتقارير والإعدادات.</p>
            </div>
          </div>
        </section>

        <section id="iphone" className="scroll-mt-24 border-y border-white/10 bg-white/[0.025]">
          <div className="max-w-6xl mx-auto px-5 py-20">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mb-5"><Apple className="w-6 h-6" /></div>
                <h2 className="text-2xl sm:text-3xl font-black">ثبت مولدتك على iPhone بدون App Store</h2>
                <p className="text-slate-400 leading-7 mt-4 text-sm">ما تحتاج تحمل ملف أو تدخل متجر. فقط تضيف نسخة الويب إلى الشاشة الرئيسية وبعدها تستخدمها مثل تطبيق مستقل.</p>
                <a href={appUrl} className="inline-flex mt-6 items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-950 font-black text-sm">فتح مولدتك على Safari <ArrowLeft className="w-4 h-4" /></a>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {iphoneSteps.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Icon className="w-5 h-5 text-blue-300 mb-4" />
                    <h3 className="font-black text-sm">{title}</h3>
                    <p className="text-xs text-slate-400 leading-6 mt-2">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="release" className="scroll-mt-24 max-w-5xl mx-auto px-5 py-20">
          <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-600/15 to-white/[0.03] p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-black mb-3"><CheckCircle2 className="w-4 h-4" /> تم بناء أول نسخة Android تجريبية بنجاح</div>
                <h2 className="text-2xl font-black">نسخة Android</h2>
                <p className="text-slate-400 text-sm leading-7 mt-2 max-w-2xl">النسخة التجريبية صارت جاهزة للاختبار. زر التنزيل العام راح يتفعّل هنا بعد اعتماد نسخة Release موقعة بشكل ثابت حتى تشتغل التحديثات المستقبلية بدون تعارض.</p>
              </div>
              <div className="shrink-0 text-center md:text-left">
                <button disabled className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600/50 text-white/70 font-black cursor-not-allowed">
                  <Download className="w-5 h-5" /> التحميل العام قريباً
                </button>
                <div className="text-[11px] text-slate-500 mt-2">الإصدار التجريبي: 1.1.0</div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><LockKeyhole className="w-5 h-5 text-blue-300 mb-3"/><h3 className="font-black text-sm">حسابات آمنة</h3><p className="text-xs leading-6 text-slate-400 mt-2">دخول الإدارة والجباة مربوط بنظام مصادقة مركزي وصلاحيات منفصلة.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Layers3 className="w-5 h-5 text-blue-300 mb-3"/><h3 className="font-black text-sm">قاعدة بيانات مشتركة</h3><p className="text-xs leading-6 text-slate-400 mt-2">المشتركين والتسديدات والفواتير والإعدادات الأساسية تبقى موحدة بين الأجهزة.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><RefreshCw className="w-5 h-5 text-blue-300 mb-3"/><h3 className="font-black text-sm">تحديث مستمر</h3><p className="text-xs leading-6 text-slate-400 mt-2">نسخة الويب تتحدث مباشرة وAndroid مهيأ لفحص الإصدارات الجديدة.</p></div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t border-white/10 bg-white/[0.025]">
          <div className="max-w-4xl mx-auto px-5 py-20">
            <div className="text-center mb-9">
              <HelpCircle className="w-8 h-8 text-blue-300 mx-auto mb-3" />
              <h2 className="text-2xl sm:text-3xl font-black">أسئلة شائعة</h2>
            </div>
            <div className="space-y-3">
              {faq.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-white/10 bg-white/5 p-5 open:bg-white/[0.07]">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-black text-sm">
                    <span>{q}</span><ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-sm text-slate-400 leading-7 mt-4 border-t border-white/10 pt-4">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-5 py-20 text-center">
          <div className="rounded-[2rem] bg-blue-600 p-8 sm:p-10 shadow-2xl shadow-blue-950/30">
            <Zap className="w-9 h-9 text-yellow-300 fill-yellow-300 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-black">مولدتك وياك وين ما تشتغل</h2>
            <p className="text-blue-100 text-sm leading-7 mt-3 max-w-xl mx-auto">افتح النظام من جهازك الحالي وسجل دخولك بنفس الحساب حتى تبقى كل بياناتك مرتبطة بمكان واحد.</p>
            <a href={appUrl} className="inline-flex mt-6 items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 font-black">دخول النظام <ArrowLeft className="w-5 h-5" /></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>مولدتك — نظام إدارة المولدات الكهربائية</span>
          <span>Android • iPhone • Web</span>
        </div>
      </footer>
    </div>
  );
}

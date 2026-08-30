import React from 'react';
import { Zap, Smartphone, Apple, Monitor, ShieldCheck, RefreshCw, Database, ReceiptText, Users, Download, ArrowLeft } from 'lucide-react';

const features = [
  { icon: Database, title: 'بياناتك بكل مكان', text: 'نفس الحساب ونفس البيانات على Android وiPhone والكمبيوتر.' },
  { icon: ReceiptText, title: 'جباية وفواتير', text: 'تسديدات، إيصالات وسجل فواتير مرتبط مباشرة بالمولدة.' },
  { icon: Users, title: 'إدارة الجباة', text: 'حسابات وصلاحيات لكل جابي مع مزامنة مركزية.' },
  { icon: RefreshCw, title: 'تحديثات Android', text: 'التطبيق يتحقق من الإصدار الجديد ويحدث بدون الاعتماد على Google Play.' },
  { icon: ShieldCheck, title: 'حماية وعزل البيانات', text: 'كل مولدة تشوف بياناتها فقط من خلال نظام صلاحيات مركزي.' },
  { icon: Smartphone, title: 'مصمم للموبايل', text: 'واجهة عملية لأجهزة SUNMI والهواتف والأجهزة اللوحية.' },
];

export default function LandingPage() {
  const appUrl = `${window.location.origin}/`;
  return (
    <div dir="rtl" className="min-h-screen bg-[#071126] text-white font-['Cairo',sans-serif]">
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
          </div>
          <div>
            <div className="font-black text-lg">مولدتك</div>
            <div className="text-[11px] text-slate-400">Moldatk</div>
          </div>
        </div>
        <a href={appUrl} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-bold transition-all">
          دخول النظام <ArrowLeft className="w-4 h-4" />
        </a>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-5 pt-14 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/15 border border-blue-500/20 text-blue-300 text-xs font-bold">
              نظام واحد لكل أجهزتك
            </div>
            <h1 className="text-4xl sm:text-5xl font-black leading-tight">إدارة المولدة والجباية<br/><span className="text-blue-400">من أي جهاز</span></h1>
            <p className="text-slate-300 leading-8 max-w-xl">استخدم مولدتك كتطبيق Android، أو من iPhone كتطبيق ويب مصغّر، أو من الكمبيوتر. كل الأجهزة مرتبطة بنفس قاعدة البيانات ونفس الحساب.</p>
            <div className="flex flex-wrap gap-3">
              <button disabled className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600/50 text-white/70 font-black cursor-not-allowed">
                <Download className="w-5 h-5" /> تحميل Android — قريباً
              </button>
              <a href={appUrl} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 font-black hover:bg-slate-100 transition-all">
                <Apple className="w-5 h-5" /> استخدامه على iPhone
              </a>
            </div>
            <p className="text-xs text-slate-500">زر تحميل Android يتفعل تلقائياً بعد اعتماد أول APK رسمي.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-blue-600/10 blur-3xl rounded-full" />
            <div className="relative bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[['Android', Smartphone], ['iPhone', Apple], ['Computer', Monitor]].map(([name, Icon]: any) => (
                  <div key={name} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                    <Icon className="w-7 h-7 mx-auto mb-2 text-blue-300" />
                    <div className="text-xs font-bold">{name}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-[#0b1731] border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between"><span className="text-slate-400 text-xs">المزامنة</span><span className="text-emerald-400 text-xs font-black">متصلة</span></div>
                <div className="h-px bg-white/10" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">المشتركين</div><div className="font-black text-xl mt-1">Cloud</div></div>
                  <div className="rounded-xl bg-white/5 p-4"><div className="text-[11px] text-slate-400">التسديدات</div><div className="font-black text-xl mt-1">Realtime</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025]">
          <div className="max-w-6xl mx-auto px-5 py-16">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">مزايا مولدتك</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-blue-300" /></div>
                  <h3 className="font-black mb-2">{title}</h3>
                  <p className="text-sm leading-6 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-5 py-16 text-center">
          <h2 className="text-2xl font-black mb-3">على iPhone بدون App Store</h2>
          <p className="text-slate-400 leading-7">افتح النظام من Safari، اضغط مشاركة، وبعدها «إضافة إلى الشاشة الرئيسية». راح يظهر مولدتك كأيقونة مستقلة وتقدر تدخل بنفس حسابك وبياناتك.</p>
        </section>
      </main>

      <footer className="border-t border-white/10 text-center text-xs text-slate-500 py-6">مولدتك — نظام إدارة المولدات الكهربائية</footer>
    </div>
  );
}

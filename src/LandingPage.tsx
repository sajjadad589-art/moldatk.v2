import React from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Gauge,
  Monitor,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  Wifi,
  Zap,
} from 'lucide-react';

const features = [
  { icon: Users, title: 'إدارة المشتركين', text: 'إضافة وتعديل ومتابعة حالة كل مشترك بصورة واضحة وسريعة.' },
  { icon: WalletCards, title: 'الجباية والديون', text: 'تسديدات شهرية، ديون مرحلة، وقاصة مرتبطة بالحركات المالية الفعلية.' },
  { icon: BarChart3, title: 'تقارير شهرية', text: 'أرشيف لكل شهر مع المسددين وغير المسددين والمبالغ والتفاصيل.' },
  { icon: ReceiptText, title: 'إيصالات احترافية', text: 'إيصال واضح ومهيأ للطباعة على أجهزة SUNMI والطابعات الحرارية.' },
  { icon: RefreshCw, title: 'مزامنة بين الأجهزة', text: 'نفس الحساب والبيانات على Android والويب بدون تكرار العمل.' },
  { icon: ShieldCheck, title: 'عزل وحماية البيانات', text: 'كل صاحب مولدة وطاقمه يعملون ضمن بيانات حسابهم وصلاحياتهم.' },
];

const faq = [
  ['هل أستطيع استخدام مولدتك على أكثر من جهاز؟', 'نعم. الحساب يعمل على Android والويب، والبيانات الأساسية تبقى متزامنة بين الأجهزة المصرح لها.'],
  ['هل التطبيق مخصص لصاحب المولدة والجابي؟', 'نعم. توجد واجهة للإدارة وواجهة للكادر الميداني مع صلاحيات منفصلة.'],
  ['هل يدعم الطباعة الحرارية؟', 'نعم. توجد طباعة مهيأة لأجهزة SUNMI والطابعات الحرارية المدعومة.'],
  ['هل الديون تضيع عند فتح شهر جديد؟', 'لا. النظام الشهري يحتفظ بديون الأشهر السابقة ويرحلها حسب الحسابات المسجلة.'],
];

const apkUrl = 'https://github.com/sajjadad589-art/moldatk.v2/releases/latest/download/Moldatk-Android-Release.apk';

const BrandLockup = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-3" dir="rtl">
    <img src="/brand/moldatk-mark.svg" alt="" className={compact ? 'w-11 h-11' : 'w-16 h-16 sm:w-20 sm:h-20'} />
    <div className="leading-none">
      <div className={`${compact ? 'text-2xl' : 'text-4xl sm:text-5xl'} font-black tracking-tight text-[#0B1F3B]`}>مولدتك</div>
      <div className={`${compact ? 'text-[10px]' : 'text-xs sm:text-sm'} mt-2 font-bold text-[#667689]`}>إدارة المولدات بسهولة</div>
    </div>
  </div>
);

export default function LandingPage() {
  const appUrl = `${window.location.origin}/`;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F9FC] text-[#0B1F3B] font-['Cairo',sans-serif] selection:bg-[#F2B544] selection:text-[#0B1F3B]">
      <header className="sticky top-0 z-40 border-b border-[#DCE4EC] bg-white/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-[78px] flex items-center justify-between gap-6">
          <a href="#top" aria-label="مولدتك" className="shrink-0"><BrandLockup compact /></a>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-[#526274]">
            <a href="#features" className="hover:text-[#0B1F3B] transition-colors">المزايا</a>
            <a href="#workflow" className="hover:text-[#0B1F3B] transition-colors">طريقة العمل</a>
            <a href="#platforms" className="hover:text-[#0B1F3B] transition-colors">الأجهزة</a>
            <a href="#faq" className="hover:text-[#0B1F3B] transition-colors">الأسئلة</a>
          </nav>

          <div className="flex items-center gap-2">
            <a href={appUrl} className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#CBD6E2] bg-white text-sm font-black text-[#0B1F3B] hover:bg-[#F2F5F8] transition-colors">
              تسجيل الدخول
            </a>
            <a href={appUrl} className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#0B1F3B] text-white text-sm font-black hover:bg-[#142A45] transition-colors shadow-sm">
              ابدأ الآن <ArrowLeft className="w-4 h-4 text-[#F2B544]" />
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-[#E3E9EF] bg-gradient-to-b from-white to-[#F7F9FC]">
          <div className="absolute -top-24 right-[16%] w-80 h-80 rounded-full bg-[#F2B544]/10 blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="rounded-[32px] border border-[#D8E1EA] bg-white p-4 sm:p-6 shadow-[0_24px_80px_rgba(11,31,59,0.10)]">
                <div className="rounded-[24px] bg-[#0B1F3B] p-4 sm:p-6 text-white overflow-hidden relative">
                  <div className="absolute -left-12 -bottom-16 w-52 h-52 rounded-full bg-[#F2B544]/15 blur-2xl" />
                  <div className="relative flex items-center justify-between gap-3 pb-5 border-b border-white/10">
                    <div>
                      <p className="text-[11px] text-slate-300 font-bold">لوحة التحكم</p>
                      <h3 className="font-black mt-1">ملخص هذا الشهر</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center"><img src="/brand/moldatk-mark.svg" className="w-9 h-9" alt="" /></div>
                  </div>

                  <div className="relative grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                      <Users className="w-5 h-5 text-[#F2B544]" />
                      <span className="block text-[10px] text-slate-300 mt-3">المشتركون</span>
                      <strong className="block text-xl mt-1">إدارة كاملة</strong>
                    </div>
                    <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                      <WalletCards className="w-5 h-5 text-[#F2B544]" />
                      <span className="block text-[10px] text-slate-300 mt-3">التحصيل</span>
                      <strong className="block text-xl mt-1">لحظي وواضح</strong>
                    </div>
                    <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                      <BarChart3 className="w-5 h-5 text-[#F2B544]" />
                      <span className="block text-[10px] text-slate-300 mt-3">التقارير</span>
                      <strong className="block text-xl mt-1">أرشيف شهري</strong>
                    </div>
                    <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                      <ReceiptText className="w-5 h-5 text-[#F2B544]" />
                      <span className="block text-[10px] text-slate-300 mt-3">الإيصالات</span>
                      <strong className="block text-xl mt-1">جاهزة للطباعة</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {['الرئيسية', 'المشتركون', 'التقارير'].map((item, i) => (
                    <div key={item} className={`rounded-xl border px-2 py-3 text-center text-[11px] font-black ${i === 0 ? 'border-[#F2B544]/50 bg-[#FFF8E7] text-[#A66D00]' : 'border-[#E0E7EE] bg-[#F8FAFC] text-[#637286]'}`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF7E3] border border-[#F2B544]/35 px-3.5 py-2 text-xs font-black text-[#946100]">
                <Gauge className="w-4 h-4" /> نظام عملي لإدارة المولدات والاشتراكات
              </div>

              <BrandLockup />

              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.18] tracking-tight text-[#0B1F3B]">
                  كل شيء<br/><span className="relative inline-block">تحت السيطرة<span className="absolute right-0 -bottom-2 w-24 h-1.5 rounded-full bg-[#F2B544]" /></span>
                </h1>
                <p className="mt-7 max-w-xl text-[#526274] text-sm sm:text-base leading-8 font-medium">
                  مولدتك يجمع المشتركين، الجباية، التسعيرات، الديون، التقارير والطباعة في مكان واحد واضح ومريح لصاحب المولدة والكادر.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={appUrl} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0B1F3B] text-white font-black hover:bg-[#142A45] transition-colors shadow-lg shadow-[#0B1F3B]/10">
                  فتح النظام <ArrowLeft className="w-5 h-5 text-[#F2B544]" />
                </a>
                <a href={apkUrl} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-[#CBD6E2] text-[#0B1F3B] font-black hover:bg-[#F4F7FA] transition-colors">
                  <Download className="w-5 h-5 text-[#D89A21]" /> تنزيل Android
                </a>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#68798C]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> مزامنة مركزية</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> صلاحيات منفصلة</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> دعم الطباعة</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[#B57600] text-xs font-black">إدارة أسهل، معلومات أوضح</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-2">المزايا الأساسية</h2>
            <p className="text-[#69798B] mt-4 text-sm leading-7">واجهة هادئة، لكن خلفها كل الأدوات التي يحتاجها تشغيل المولدة يومياً.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-white border border-[#E0E7EE] p-6 shadow-[0_12px_34px_rgba(11,31,59,0.045)] hover:-translate-y-1 transition-transform">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF6DE] text-[#C88709] flex items-center justify-center mb-5"><Icon className="w-5 h-5" /></div>
                <h3 className="font-black text-lg">{title}</h3>
                <p className="text-[#6A7A8C] text-sm leading-7 mt-2">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 border-y border-[#E1E8EF] bg-white">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-[30px] border border-[#DDE5EC] bg-[#F7F9FC] p-5 sm:p-8">
              <div className="grid gap-3">
                {[
                  ['01', 'أضف المشتركين', 'سجل البيانات، الأمبير والفئة بصورة منظمة.'],
                  ['02', 'اعتمد التسعيرة الشهرية', 'كل شهر يبدأ بدورة حساب مستقلة ويحافظ على الديون السابقة.'],
                  ['03', 'استلم واطبع', 'سجل الدفعة واطبع الإيصال وراقب القاصة والتقارير.'],
                ].map(([n, title, text]) => (
                  <div key={n} className="flex items-start gap-4 rounded-2xl bg-white border border-[#E1E8EF] p-4">
                    <span className="w-10 h-10 rounded-xl bg-[#0B1F3B] text-[#F2B544] flex items-center justify-center font-black shrink-0">{n}</span>
                    <div><h3 className="font-black">{title}</h3><p className="text-[#718092] text-xs leading-6 mt-1">{text}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[#B57600] text-xs font-black">نظام شهري واضح</span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 leading-tight">من التسعيرة إلى التحصيل<br/>بدون ضياع بالحسابات</h2>
              <p className="text-[#667689] leading-8 mt-5 text-sm">كل شهر محفوظ بسجله، وحالة التسديد والديون تبقى قابلة للمراجعة من التقارير. الهدف أن يعرف صاحب المولدة والجابي أين وصل الحساب بدون جداول منفصلة.</p>
            </div>
          </div>
        </section>

        <section id="platforms" className="scroll-mt-24 max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3 mb-6 text-center"><h2 className="text-3xl sm:text-4xl font-black">اشتغل من الجهاز المناسب إلك</h2><p className="text-[#6D7D8F] text-sm mt-3">نفس النظام والهوية على الموبايل والكمبيوتر.</p></div>
            {[
              [Smartphone, 'Android', 'تطبيق مخصص للموبايل وأجهزة SUNMI مع الطباعة والتحديثات.'],
              [Monitor, 'الكمبيوتر', 'واجهة واسعة للإدارة، التقارير، المشتركين والإعدادات.'],
              [Wifi, 'الويب', 'دخول مباشر من المتصفح مع نفس بيانات الحساب المتزامنة.'],
            ].map(([Icon, title, text]: any) => (
              <div key={title} className="rounded-3xl bg-white border border-[#E0E7EE] p-7">
                <Icon className="w-8 h-8 text-[#D89A21] mb-5" /><h3 className="text-xl font-black">{title}</h3><p className="text-sm text-[#6A7A8C] leading-7 mt-2">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-[#0B1F3B] text-white">
          <div className="max-w-4xl mx-auto px-5 py-20">
            <div className="text-center mb-10"><span className="text-[#F2B544] text-xs font-black">قبل ما تبدأ</span><h2 className="text-3xl font-black mt-2">أسئلة شائعة</h2></div>
            <div className="space-y-3">
              {faq.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-white/10 bg-white/[0.045] open:bg-white/[0.07]">
                  <summary className="list-none cursor-pointer p-5 flex items-center justify-between gap-4 font-black text-sm"><span>{q}</span><ChevronDown className="w-5 h-5 text-[#F2B544] transition-transform group-open:rotate-180" /></summary>
                  <p className="px-5 pb-5 text-sm leading-7 text-slate-300">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#081521] text-slate-400 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLockup compact />
          <div className="text-xs text-center sm:text-left">مولدتك — نظام إدارة المولدات والاشتراكات</div>
        </div>
      </footer>
    </div>
  );
}

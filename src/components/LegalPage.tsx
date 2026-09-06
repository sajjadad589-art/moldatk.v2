import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type LegalPageKind = 'privacy' | 'terms' | 'delete-account';

const UPDATED_AT = '6 أيلول 2026';

const LegalShell = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div dir="rtl" className="min-h-screen bg-[#F7F9FC] text-[#0B1F3B] font-['Cairo',sans-serif]">
    <header className="border-b border-[#DDE5EC] bg-white">
      <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-3 min-w-0" aria-label="العودة إلى مولدتك">
          <img src="/brand/moldatk-mark.svg" alt="" className="w-10 h-10 rounded-xl bg-white object-contain" />
          <div className="min-w-0">
            <strong className="block text-lg font-black leading-tight">مولدتك</strong>
            <span className="block text-[11px] text-[#667689]">إدارة المولدات والاشتراكات</span>
          </div>
        </a>
        <a href="/" className="inline-flex items-center gap-1.5 text-xs font-black text-[#0B1F3B] hover:text-[#D89A21]">
          <ArrowRight className="w-4 h-4" /> العودة للنظام
        </a>
      </div>
    </header>

    <main className="max-w-4xl mx-auto px-5 py-8 sm:py-12">
      <div className="rounded-[28px] border border-[#DDE5EC] bg-white shadow-[0_18px_60px_rgba(11,31,59,0.08)] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#E6EBF0] bg-gradient-to-l from-[#FFF8E8] to-white">
          <div className="w-11 h-11 rounded-2xl bg-[#0B1F3B] text-[#F2B544] flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div>
          <h1 className="text-2xl sm:text-3xl font-black">{title}</h1>
          <p className="mt-2 text-xs text-[#6B7B8D]">آخر تحديث: {UPDATED_AT}</p>
        </div>
        <div className="p-6 sm:p-8 prose prose-slate max-w-none text-sm leading-8 text-[#44566A]">
          {children}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-[#667689]">
        <a href="/privacy" className="hover:text-[#0B1F3B]">سياسة الخصوصية</a>
        <a href="/terms" className="hover:text-[#0B1F3B]">الشروط والأحكام</a>
        <a href="/delete-account" className="hover:text-[#0B1F3B]">طلب حذف الحساب والبيانات</a>
      </div>
    </main>
  </div>
);

const PrivacyPage = () => (
  <LegalShell title="سياسة الخصوصية" icon={ShieldCheck}>
    <section className="space-y-5">
      <p>توضح هذه السياسة كيف يتعامل تطبيق <strong>مولدتك</strong> مع البيانات عند استخدام نظام إدارة المولدات والاشتراكات على الويب أو Android.</p>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">1. البيانات التي نعالجها</h2>
        <p>قد يعالج النظام بيانات حساب المالك أو الجابي مثل البريد الإلكتروني ورقم الهاتف والاسم وصلاحية الحساب، وبيانات التشغيل التي يدخلها المستخدم مثل أسماء المشتركين وأرقام هواتفهم وعناوينهم والكابينات وعدد الأمبيرات والتسعيرات والديون والتسديدات والإيصالات وسجل الحركات.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">2. بيانات الجهاز والإشعارات</h2>
        <p>عند تفعيل الإشعارات قد يسجل النظام رمز جهاز للإشعارات ومعلومات تقنية لازمة لإرسال التنبيهات والتحقق من إصدار التطبيق. لا نستخدم هذه البيانات للإعلانات السلوكية.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">3. الغرض من استخدام البيانات</h2>
        <p>تستخدم البيانات لتسجيل الدخول، عزل كل حساب مولدة عن الحسابات الأخرى، مزامنة البيانات بين الأجهزة المصرح بها، تنفيذ الجباية والتقارير والطباعة، إدارة الاشتراك، تحسين الاستقرار والأمان، وإرسال إشعارات تشغيلية عند تفعيلها.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">4. الخدمات التقنية</h2>
        <p>يعتمد مولدتك على خدمات سحابية لازمة لتشغيل التطبيق، ومنها Supabase للمصادقة وقاعدة البيانات والمزامنة، وFirebase Cloud Messaging للإشعارات على Android عند تفعيلها. قد تعالج هذه الخدمات بيانات تقنية بالقدر اللازم لتقديم الخدمة.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">5. مشاركة البيانات</h2>
        <p>لا نبيع بيانات المستخدمين. لا تتم مشاركة البيانات إلا لتشغيل الخدمة عبر مزودي البنية التقنية، أو إذا تطلب القانون ذلك، أو عند طلب المستخدم صراحة تنفيذ إجراء يتطلب مشاركة محددة.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">6. الحفظ والأمان</h2>
        <p>نحتفظ بالبيانات ما دامت لازمة لتقديم الخدمة أو للمتطلبات التشغيلية والمحاسبية المشروعة. نستخدم المصادقة والصلاحيات وعزل الحسابات للحد من الوصول غير المصرح به، مع التنبيه إلى أن أي خدمة إلكترونية لا يمكن ضمان خلوها من المخاطر بصورة مطلقة.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">7. حقوق المستخدم والحذف</h2>
        <p>يمكن طلب حذف الحساب والبيانات من صفحة <a className="font-black text-[#B57600]" href="/delete-account">طلب حذف الحساب والبيانات</a>. بعد التحقق من ملكية الحساب، يتم حذف البيانات التي يمكن حذفها، وقد يحتفظ النظام ببعض السجلات التي يلزم الاحتفاظ بها لأسباب قانونية أو محاسبية أو أمنية مع تقييد استخدامها.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">8. بيانات المشتركين التي يدخلها صاحب المولدة</h2>
        <p>صاحب المولدة أو الجهة المشغلة هي المسؤولة عن مشروعية إدخال بيانات مشتركيها واستخدامها داخل مولدتك، وعن منح الصلاحيات المناسبة لموظفيها وجباتها.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">9. التعديلات</h2>
        <p>قد يتم تحديث هذه السياسة عند تغير وظائف التطبيق أو المتطلبات القانونية. ينشر تاريخ آخر تحديث أعلى الصفحة.</p>
      </div>
    </section>
  </LegalShell>
);

const TermsPage = () => (
  <LegalShell title="الشروط والأحكام" icon={FileText}>
    <section className="space-y-5">
      <p>باستخدام <strong>مولدتك</strong> فإنك توافق على هذه الشروط باعتبار التطبيق أداة لإدارة بيانات المولدات والاشتراكات والجباية والتقارير والطباعة.</p>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">1. الحساب والصلاحيات</h2>
        <p>يلتزم المستخدم بالمحافظة على بيانات الدخول وعدم مشاركتها مع أشخاص غير مخولين. صاحب حساب المولدة مسؤول عن إنشاء حسابات الجباة وتحديد الكابينات والصلاحيات المسموحة لهم.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">2. دقة البيانات</h2>
        <p>المستخدم مسؤول عن صحة بيانات المشتركين والتسعيرات والديون والتسديدات التي يدخلها أو يعتمدها. ينبغي مراجعة المعلومات قبل اعتمادها أو طباعتها.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">3. الاستخدام المسموح</h2>
        <p>يمنع استخدام التطبيق للوصول غير المصرح به إلى حسابات أخرى، أو إدخال بيانات بصورة مخالفة للقانون، أو محاولة تعطيل الخدمة أو تجاوز آليات الحماية والصلاحيات.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">4. المدفوعات والجباية</h2>
        <p>مولدتك يسجل عمليات الجباية والحسابات التي يدخلها المستخدم، ولا يعد بحد ذاته جهة مصرفية أو بوابة تحويل أموال. مسؤولية استلام الأموال الفعلية وتسويتها تقع على صاحب المولدة وكادره.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">5. التوفر والتحديثات</h2>
        <p>قد تصدر تحديثات لإصلاح الأخطاء أو تحسين الأمان أو التوافق. بعض الميزات السحابية تحتاج اتصالاً بالإنترنت، وقد تتأثر مؤقتاً بانقطاع الشبكة أو خدمات الطرف الثالث.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">6. النسخ الاحتياطي</h2>
        <p>رغم وجود مزامنة ووسائل نسخ احتياطي داخل النظام، يبقى من الأفضل الاحتفاظ بنسخ مناسبة من البيانات المهمة وفق إجراءات العمل لدى المستخدم.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">7. إيقاف أو حذف الحساب</h2>
        <p>يجوز إيقاف الحساب عند انتهاء الاشتراك أو إساءة الاستخدام أو وجود سبب أمني. ويمكن للمستخدم تقديم طلب حذف من صفحة <a className="font-black text-[#B57600]" href="/delete-account">حذف الحساب والبيانات</a>.</p>
      </div>

      <div>
        <h2 className="font-black text-[#0B1F3B] text-base">8. التعديلات</h2>
        <p>قد تتغير هذه الشروط مع تطور الخدمة. استمرار الاستخدام بعد نشر النسخة المحدثة يعني قبول الشروط المحدثة.</p>
      </div>
    </section>
  </LegalShell>
);

const DeleteAccountPage = () => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() && !phone.trim()) {
      setError('أدخل البريد الإلكتروني أو رقم الهاتف المرتبط بالحساب حتى نتمكن من التحقق منه.');
      return;
    }
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from('account_deletion_requests').insert({
        app_name: 'مولدتك',
        email: email.trim() || null,
        phone: phone.trim() || null,
        details: details.trim() || null,
        status: 'pending',
      });
      if (insertError) throw insertError;
      setDone(true);
    } catch (err) {
      console.error('Account deletion request failed:', err);
      setError('تعذر إرسال الطلب حالياً. حاول مرة أخرى بعد قليل.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LegalShell title="طلب حذف الحساب والبيانات" icon={Trash2}>
      <section className="space-y-5">
        <p>هذه الصفحة مخصصة لمستخدمي <strong>مولدتك</strong> لتقديم طلب حذف الحساب والبيانات المرتبطة به.</p>
        <div className="rounded-2xl border border-[#E3D2A5] bg-[#FFF9EA] p-4 text-xs leading-7 text-[#6D5724]">
          بعد استلام الطلب يتم التحقق من ملكية الحساب قبل الحذف. قد نطلب معلومات إضافية للتحقق. قد تبقى بعض السجلات المحدودة إذا كان الاحتفاظ بها مطلوباً لأسباب قانونية أو محاسبية أو أمنية، مع تقييد استخدامها.
        </div>

        {done ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-1 shrink-0" />
            <div>
              <strong className="block font-black">تم استلام طلبك.</strong>
              <p className="text-xs mt-1 leading-6">سيتم مراجعته والتحقق من ملكية الحساب قبل تنفيذ الحذف.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#DDE5EC] bg-[#FBFCFD] p-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-xs font-bold text-[#526274]">
                البريد الإلكتروني للحساب
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1.5 w-full rounded-xl border border-[#CCD7E2] bg-white px-3 py-2.5 outline-none focus:border-[#D89A21]" />
              </label>
              <label className="text-xs font-bold text-[#526274]">
                رقم الهاتف
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXXX" className="mt-1.5 w-full rounded-xl border border-[#CCD7E2] bg-white px-3 py-2.5 outline-none focus:border-[#D89A21]" />
              </label>
            </div>
            <label className="text-xs font-bold text-[#526274] block">
              تفاصيل تساعد على تحديد الحساب (اختياري)
              <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder="مثلاً: اسم المولدة أو اسم صاحب الحساب" className="mt-1.5 w-full rounded-xl border border-[#CCD7E2] bg-white px-3 py-2.5 outline-none focus:border-[#D89A21] resize-y" />
            </label>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
            <button disabled={busy} type="submit" className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0B1F3B] hover:bg-[#142A45] disabled:opacity-60 text-white text-xs font-black">
              {busy ? 'جاري إرسال الطلب...' : 'إرسال طلب الحذف'}
            </button>
          </form>
        )}

        <div>
          <h2 className="font-black text-[#0B1F3B] text-base">ما الذي يشمله الحذف؟</h2>
          <p>بحسب نوع الحساب، قد يشمل ذلك بيانات الملف الشخصي وبيانات المولدة والمشتركين والجباة والإعدادات والسجلات التشغيلية المرتبطة بالحساب، مع استثناء البيانات التي يلزم الاحتفاظ بها قانونياً أو محاسبياً أو أمنياً.</p>
        </div>
      </section>
    </LegalShell>
  );
};

export default function LegalPage({ kind }: { kind: LegalPageKind }) {
  if (kind === 'terms') return <TermsPage />;
  if (kind === 'delete-account') return <DeleteAccountPage />;
  return <PrivacyPage />;
}

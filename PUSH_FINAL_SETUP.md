# الإعداد النهائي للإشعارات — molidatk

هذه النسخة تحتوي على نظام إشعارات موحد:

- Android / SUNMI APK: Firebase Cloud Messaging عبر Capacitor.
- المتصفح وPWA: Web Push قياسي يعمل على Chrome/Firefox/Edge وعلى iPhone/iPad عند تثبيت الموقع على الشاشة الرئيسية.
- جميع الإشعارات تبقى أيضاً محفوظة داخل مركز إشعارات التطبيق.

## 1) Android client

انسخ ملف Firebase الذي سبق تنزيله إلى:

`android/app/google-services.json`

ثم شغّل:

```bash
npm install
npx cap sync android
```

## 2) Android server sending

دالة Supabase المسؤولة عن النشر اسمها `publish-notification` وهي منشورة بالفعل.
لإرسال FCM إلى APK تحتاج إضافة 3 Edge Function Secrets داخل مشروع Supabase `molidatk`:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

القيم تؤخذ من Firebase Console > Project settings > Service accounts > Generate new private key.
لا تضع Service Account JSON داخل مجلد `src` أو داخل كود الواجهة.

## 3) Web / iPhone

لا يحتاج Firebase Web App. النظام يستخدم Web Push القياسي مباشرة.

- الموقع المنشور يجب أن يكون HTTPS.
- على Android/PC browser: اضغط «تفعيل إشعارات الجهاز» مرة واحدة.
- على iPhone/iPad: أضف الموقع إلى الشاشة الرئيسية، افتحه من الأيقونة، ثم اضغط «تفعيل الإشعارات».

بعد ذلك زر «نشر الإشعار» في Super Admin يرسل نفس الرسالة إلى كل القنوات المسجلة، أو إلى مولدة محددة حسب الاختيار.

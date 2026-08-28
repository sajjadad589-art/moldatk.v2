# مولدتك — Rebuild V5

## الإصلاحات الرئيسية
- منع طباعة أي وصل قبل حفظ التسديد فعلياً.
- التسديد الكامل/الجزئي/المجاني يحفظ أولاً ثم تظهر رسالة نجاح ثم يبدأ أمر الطباعة التلقائية إذا كان مفعلاً.
- زر التسديد أصبح زر واضح وبارز (`تسديد الآن`) مع أيقونة وحدود وظل وحجم لمس مناسب للهاتف وSUNMI.
- زر تأكيد التسديد داخل نافذة الدفع أصبح كبيراً وواضحاً ويتغير لونه حسب نوع التسديد.
- طباعة Android/SUNMI أصبحت Native مباشرة عبر خدمة الطابعة المدمجة بدل `window.print()`.
- طباعة SUNMI تستخدم نصاً أسود/غامقاً وأحجاماً أكبر مع سطر تغذية واحد فقط بعد نهاية الوصل لتقليل الفراغات.
- طباعة المتصفح بقيت كـ fallback فقط عند التشغيل من المتصفح/الكمبيوتر.
- إضافة package visibility لخدمة SUNMI في AndroidManifest.
- إصدار Android: versionCode 2 / versionName 1.1.0.

## التشغيل على الكمبيوتر
```powershell
npm install
npm run dev
```

## بناء نسخة Android بعد الاختبار
```powershell
npm run build
npx cap sync android
cd android
.\\gradlew assembleDebug
```

> عند أول بناء Android سيحتاج Gradle لتنزيل مكتبة SUNMI الرسمية `com.sunmi:printerlibrary:1.0.18`.

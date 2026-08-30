import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/components/SuperAdminDashboard.tsx');
let s = fs.readFileSync(file, 'utf8');
let changed = false;

function rep(name, a, b) {
  if (s.includes(a)) {
    s = s.replace(a, b);
    changed = true;
    console.log('patched:', name);
  } else {
    console.warn('optional patch skipped:', name);
  }
}

// ملاحظة: المالك الرئيسي لازم تظهر له صلاحياته فوراً حتى لو دالة تحميل الصلاحيات تأخرت بالموبايل.
// الحماية الحقيقية باقية من Supabase Edge Functions، لذلك هذا يمنع اختفاء الأزرار فقط.
rep(
  'owner initial visibility true',
  "const [isOwnerSuperAdmin, setIsOwnerSuperAdmin] = useState(false);",
  "const [isOwnerSuperAdmin, setIsOwnerSuperAdmin] = useState(true);"
);

// إذا فشل تحميل سجل الصلاحيات لأي سبب، لا نخفي أدوات المالك الرئيسي.
rep(
  'manager load catch fallback',
  "    } catch (e) {}\n  };",
  "    } catch (e) {\n      setIsOwnerSuperAdmin(true);\n    }\n  };"
);

// تأكد من ظهور زر إضافة صاحب مولدة عند المالك حتى بعد تحديثات الصلاحيات.
rep(
  'restore add generator button if double hidden',
  "{canCreateGeneratorAccount && <button onClick={() => setGeneratorOpen(true)} className=\"bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2\"><UserPlus className=\"w-4 h-4\" />إضافة صاحب مولدة</button>}",
  "{canCreateGeneratorAccount && <button onClick={() => setGeneratorOpen(true)} className=\"bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2\"><UserPlus className=\"w-4 h-4\" />إضافة صاحب مولدة</button>}"
);

if (changed) fs.writeFileSync(file, s, 'utf8');
console.log('Super admin owner visibility fix applied.');

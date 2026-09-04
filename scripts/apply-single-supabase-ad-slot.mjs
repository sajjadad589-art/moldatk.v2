import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

// Super Admin: one advertisement slot only. Saving a new ad disables old active app ads, then saves the current one.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('SINGLE_SUPABASE_AD_SLOT_V1')) {
      c = c.replaceAll('إعلان داخل التطبيق', 'الإعلان المحفوظ داخل التطبيق');
      c = c.replaceAll('حفظ الإعلان في Supabase', 'حفظ وتحديث الإعلان');
      c = c.replaceAll('ينحفظ مباشرة في Supabase ويظهر لأصحاب المولدات بالموبايل', 'إعلان واحد فقط: عند الحفظ يتحدث نفس مكان الإعلان لكل المستخدمين');
      c = c.replaceAll('تم ربط الإعلان وحفظه في Supabase وسيظهر داخل إعدادات التطبيق حسب الاستهداف', 'تم حفظ الإعلان وتحديث الإعلان الحالي داخل التطبيق');

      const insertNeedle = "      const { error } = await supabase.from('app_notifications').insert({";
      if (c.includes(insertNeedle)) {
        c = c.replace(
          insertNeedle,
          "      // SINGLE_SUPABASE_AD_SLOT_V1: keep one active ad only, then insert the replacement slot.\n      await supabase\n        .from('app_notifications')\n        .update({ is_active: false, ends_at: new Date().toISOString(), expires_at: new Date().toISOString() })\n        .eq('is_active', true)\n        .in('category', ['offer', 'update', 'general']);\n\n" + insertNeedle
        );
      } else {
        console.warn('single ad slot skip: insert anchor not found');
      }

      // Prefer showing only the latest active ad in the admin list too.
      c = c.replaceAll(".order('created_at', { ascending: false })", ".order('priority', { ascending: false })\n        .order('created_at', { ascending: false })\n        .limit(1)");

      write(path, c);
      console.log('Applied single persistent Supabase advertisement slot to Super Admin');
    }
  }
}

// Mobile settings: render one ad only from Supabase/cache, not a carousel of many ads.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('SINGLE_MOBILE_SUPABASE_AD_SLOT_V1')) {
      c = c.replaceAll('إعلانات الإدارة', 'إعلان الإدارة');
      c = c.replaceAll("setSupabaseAds(JSON.parse(cached))", "setSupabaseAds(JSON.parse(cached).slice(0, 1))");
      c = c.replaceAll('.limit(10)', '.limit(1)');
      c = c.replaceAll('const rows = data.filter((ad: any) => (!ad.ends_at || ad.ends_at > now) && (!ad.expires_at || ad.expires_at > now));', "const rows = data.filter((ad: any) => (!ad.ends_at || ad.ends_at > now) && (!ad.expires_at || ad.expires_at > now)).slice(0, 1);");
      c = c.replaceAll('overflow-x-auto no-scrollbar snap-x', 'overflow-hidden');
      c = c.replaceAll('min-w-[86%] snap-center', 'w-full');
      c = '// SINGLE_MOBILE_SUPABASE_AD_SLOT_V1\n' + c;
      write(path, c);
      console.log('Applied one-ad-only mobile settings display');
    }
  }
}

console.log('Single Supabase ad slot patch applied.');

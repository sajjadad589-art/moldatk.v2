-- تصفير بيانات مشروع مولدتك قبل إطلاق النسخة الأولية
-- مهم: هذا الملف يبقي حساب السوبر أدمن حتى لا تفقد الدخول.
-- نفّذه من Supabase SQL Editor فقط إذا كنت متأكد أن البيانات تجريبية.

begin;

delete from notification_reads;
delete from web_push_subscriptions;
delete from device_push_tokens;
delete from app_notifications;
delete from admin_transactions;
delete from subscriptions;
delete from profiles where role <> 'super_admin';
delete from generators;

commit;

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL only. No network or production credentials.
const db = new PGlite();
const gid='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const collector='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const operational=['generator_payment_allocations','generator_payments','generator_invoices',
  'generator_monthly_accounts','generator_subscribers','generator_audit_logs','generator_cashbox_entries',
  'generator_cashbox_resets','generator_collectors','generator_lines','generator_monthly_tariffs',
  'generator_settings','owner_ai_actions','owner_ai_pending_actions','owner_ai_issues','owner_ai_sessions',
  'app_popup_notifications','app_notifications','device_push_tokens','web_push_subscriptions'];
const guarded=['generator_subscribers','generator_invoices','generator_monthly_accounts',
  'generator_payments','generator_payment_allocations','generator_monthly_tariffs','generator_lines',
  'generator_settings','generator_audit_logs'];
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema moldatk_private;
  grant usage on schema auth to authenticated, service_role;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
  create table generators(id uuid primary key);
  insert into generators values('${gid}'),('${other}');
  create function public.is_generator_admin_for(g uuid) returns boolean language sql as $$ select auth.uid()='${owner}'::uuid and g='${gid}'::uuid $$;`);
for(const table of operational) await db.exec(`create table public.${table}(id text, generator_id uuid references generators(id), amount bigint default 0);`);
await db.exec(`create function public.is_active_collector_for(g uuid) returns boolean language sql as $$
  select auth.uid()='${collector}'::uuid and exists(select 1 from public.generator_collectors where id=auth.uid()::text and generator_id=g) $$;
  grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
  insert into generator_collectors(id,generator_id) values('${collector}','${gid}');`);
const original=fs.readFileSync('supabase/migrations/20260915071500_financial_operations_hardening.sql','utf8');
await db.exec(original.slice(original.indexOf('create or replace function public.reset_generator_account_operational_data')));
const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_generator_reset_sync_epoch.sql'));
await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
const asUser=async (uid=owner, epoch='0')=>db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set request.jwt.claim.role='authenticated'; set request.headers='{"x-moldatk-sync-epoch":"${epoch}"}'; set role authenticated;`);
const asService=async()=>db.exec(`reset role;set request.jwt.claim.role='service_role';set role service_role;`);
const state=async(g=gid)=>(await db.query(`select get_generator_sync_state('${g}') s`)).rows[0].s;
const reset=async()=>db.query(`select reset_generator_account_operational_data('${gid}') s`);
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await test('owner and active collector read same epoch; other generator reveals no state',async()=>{
  await asUser(); const expected=await state(); assert.deepEqual(expected,{authorized:true,epoch:0});
  await asUser(collector);assert.deepEqual(await state(),expected);
  assert.deepEqual(await state(other),{authorized:false});
  assert.equal((await db.query(`select * from generator_sync_state where generator_id='${other}'`)).rows.length,0);
});
await test('clients cannot forge epoch, call reset or call its implementation',async()=>{
  await assert.rejects(db.exec('update generator_sync_state set epoch=99'),/permission denied/);
  await assert.rejects(reset(),/permission denied/);
  await assert.rejects(db.query(`select reset_generator_account_operational_data_before_epoch('${gid}')`),/permission denied/);
});
await test('pre-reset writes succeed; actual purge clears all financial data and atomically advances epoch',async()=>{
  await asUser();for(const table of guarded) await db.exec(`insert into ${table}(id,generator_id,amount) values('old','${gid}',90000)`);
  await asService(); const r=(await reset()).rows[0].s;assert.equal(r.epoch,1);
  for(const table of operational) assert.equal((await db.query(`select count(*)::int n from ${table} where generator_id='${gid}'`)).rows[0].n,0,table);
  await asUser();assert.equal((await state()).epoch,1);
});
await test('collector deleted by existing full-reset semantics has no stale access',async()=>{
  await asUser(collector);assert.deepEqual(await state(),{authorized:false});
});
await test('every stale financial write is rejected after reset, including old clients without a header',async()=>{
  await asUser();
  for(const table of guarded) await assert.rejects(db.exec(`insert into ${table}(id,generator_id) values('stale','${gid}')`),/MOLDATK_STALE_SYNC_EPOCH/);
  await db.exec("set request.headers='{}'");
  await assert.rejects(db.exec(`insert into generator_subscribers(id,generator_id) values('legacy','${gid}')`),/MOLDATK_STALE_SYNC_EPOCH/);
});
await test('fresh client can write; stale update/delete cannot damage new data',async()=>{
  await asUser(owner,'1');await db.exec(`insert into generator_invoices(id,generator_id,amount) values('new','${gid}',12000)`);
  await asUser();
  await assert.rejects(db.exec(`update generator_invoices set amount=1 where generator_id='${gid}'`),/MOLDATK_STALE_SYNC_EPOCH/);
  await assert.rejects(db.exec(`delete from generator_invoices where generator_id='${gid}'`),/MOLDATK_STALE_SYNC_EPOCH/);
  assert.equal((await db.query('select amount from generator_invoices')).rows[0].amount,12000);
});
await test('failed reset rolls back both purge and epoch',async()=>{
  await asService(); await db.exec('begin'); await reset(); await db.exec('rollback');
  await asUser(owner,'1');assert.equal((await state()).epoch,1);
  assert.equal((await db.query('select amount from generator_invoices')).rows[0].amount,12000);
});
await test('successive resets remain durable and cannot affect other generator epochs',async()=>{
  await asService();assert.equal((await reset()).rows[0].s.epoch,2);
  assert.equal((await db.query(`select epoch from generator_sync_state where generator_id='${other}'`)).rows[0].epoch,0);
  await db.exec('reset role;set role anon');await assert.rejects(state(),/permission denied/);
});
await db.close();console.log(`Reset sync PostgreSQL regression: ${passed} PASS, 0 FAIL`);

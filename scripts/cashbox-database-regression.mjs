import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
const gid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',collector='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
await db.exec(`create role anon; create role authenticated;
create schema auth; grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.generators(id uuid primary key);
create table public.generator_settings(generator_id uuid primary key,wallet_reset_timestamp timestamptz);
create table public.generator_audit_logs(generator_id uuid not null references generators(id), id text, category text, timestamp timestamptz,amount bigint,entity_id text, primary key(generator_id,id));
create function public.is_generator_admin_for(g uuid) returns boolean language sql as $$ select auth.uid()='${admin}'::uuid and g='${gid}'::uuid $$;
create function public.is_active_collector_for(g uuid) returns boolean language sql as $$ select auth.uid()='${collector}'::uuid and g='${gid}'::uuid $$;
create function public.collector_has_permission(g uuid,p text) returns boolean language sql as $$ select public.is_active_collector_for(g) $$;
insert into generators values('${gid}'),('${other}');
grant select on generators to authenticated;
insert into generator_settings values('${gid}',null);
insert into generator_audit_logs values('${gid}','historical','payment','2026-01-01',522000,'s1');`);
const migration=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('_event_sync_cashbox_reset.sql'));
await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function asUser(user=admin){await db.exec(`reset role;set request.jwt.claim.sub='${user}';set role authenticated;`);}
async function owner(){await db.exec('reset role;');}
const state=async()=> (await db.query(`select public.get_generator_cashbox('${gid}') s`)).rows[0].s;
const reset=async(req)=> (await db.query(`select public.reset_generator_cashbox('${gid}','${req}') s`)).rows[0].s;
const req1='10000000-0000-4000-8000-000000000001',req2='10000000-0000-4000-8000-000000000002';
let resetAt;
await test('migration preserves all historical audit rows; unreset cashbox is unchanged',async()=>{
  assert.equal((await db.query('select count(*)::int n from generator_audit_logs')).rows[0].n,1);
  await asUser();assert.equal((await state()).reset_at,null);
});
await test('reset is server-confirmed zero without deleting history',async()=>{
  const s=await reset(req1);resetAt=s.reset_at;assert.equal(s.balance,0);assert.equal(s.reset_id,req1);
  await owner();assert.equal((await db.query('select count(*)::int n from generator_audit_logs')).rows[0].n,1);
});
await test('a late offline collection before reset is excluded',async()=>{
  await db.exec(`insert into generator_audit_logs values('${gid}','late-old','payment','2026-01-02',100000,'s1')`);
  await asUser();assert.equal((await state()).balance,0);
});
await test('post-reset payment counts once after repeat sync',async()=>{
  await owner();await db.exec(`insert into generator_audit_logs values('${gid}','new','payment',clock_timestamp()+interval '1 second',12000,'s1');
    insert into generator_audit_logs values('${gid}','new','payment',clock_timestamp()+interval '1 second',12000,'s1') on conflict(generator_id,id) do update set amount=excluded.amount;`);
  await asUser();assert.equal((await state()).balance,12000);
});
await test('ambiguous retry uses same idempotency key without losing new collection',async()=>{
  const s=await reset(req1);assert.equal(s.reset_at,resetAt);assert.equal(s.balance,12000);
});
await test('cancellation after reset reduces new collections',async()=>{
  await owner();await db.exec(`insert into generator_audit_logs values('${gid}','cancel','cancellation',clock_timestamp()+interval '2 seconds',2000,'s1')`);
  await asUser();assert.equal((await state()).balance,10000);
});
await test('old client settings update cannot undo marker or balance',async()=>{
  await owner();await db.exec(`update generator_settings set wallet_reset_timestamp=null where generator_id='${gid}'`);
  await asUser();assert.equal((await state()).reset_at,resetAt);assert.equal((await state()).balance,10000);
});
await test('second reset starts zero even with future-dated existing rows',async()=>{
  const s=await reset(req2);assert.equal(s.balance,0);assert.equal(s.reset_id,req2);
});
await test('read after reconnect and collector read return identical reset balance',async()=>{
  const expected=await state();await asUser(collector);assert.deepEqual(await state(),expected);
});
await test('collector cannot reset or directly mutate reset/entry tables',async()=>{
  await assert.rejects(reset('10000000-0000-4000-8000-000000000003'),/not_authorized/);
  await assert.rejects(db.exec('delete from generator_cashbox_resets'),/permission denied/);
  await assert.rejects(db.exec('update generator_cashbox_entries set amount=0'),/permission denied/);
});
await test('cross-generator reset and reads are denied; anonymous execution denied',async()=>{
  await asUser();await assert.rejects(db.query(`select public.reset_generator_cashbox('${other}','${req1}')`),/not_authorized/);
  await assert.rejects(db.query(`select public.get_generator_cashbox('${other}')`),/not_authorized/);
  await db.exec('reset role; set role anon');await assert.rejects(state(),/permission denied/);
});
await test('history preserved after reset twice, sync replay, cancellation and denied requests',async()=>{
  await owner();assert.equal((await db.query('select count(*)::int n from generator_audit_logs')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from generator_cashbox_resets')).rows[0].n,2);
});
await db.close();console.log(`Cashbox PostgreSQL regression: ${passed} PASS, 0 FAIL`);


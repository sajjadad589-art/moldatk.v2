import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const gid = '11111111-1111-4111-8111-111111111111';
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const collector = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
await db.exec(`create role anon; create role authenticated;
create schema auth; create schema moldatk_private;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.is_generator_admin_for(g uuid) returns boolean language sql as $$ select auth.uid()='${admin}'::uuid and g='${gid}'::uuid $$;
create table generators(id uuid primary key);
create table generator_monthly_tariffs(id text primary key, generator_id uuid references generators(id));
create table generator_subscribers(id text primary key, generator_id uuid references generators(id), full_name text, tier text, is_exempted boolean default false,
  amount_due bigint default 0, amount_paid bigint default 0, payment_status text, last_payment_date text, updated_at timestamptz);
create table generator_invoices(id text primary key, generator_id uuid, subscriber_id text, total_amount bigint, paid_amount bigint, remaining_amount bigint, status text);
create table generator_audit_logs(id text primary key, generator_id uuid, category text, amount bigint);
grant usage on schema public, auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into generators values ('${gid}');
insert into generator_monthly_tariffs values ('t1','${gid}'), ('t2','${gid}');
insert into generator_subscribers(id,generator_id,full_name,tier,amount_due,amount_paid,payment_status) values ('s1','${gid}','Test','normal',196000,92000,'partial');
insert into generator_invoices values ('history','${gid}','s1',196000,92000,104000,'partial');
insert into generator_audit_logs values ('history','${gid}','payment',92000);
`);
for (const suffix of ['_no_tariff_server_state.sql','_enforce_no_tariff_billing.sql']) {
  const file = fs.readdirSync('supabase/migrations').find(f => f.endsWith(suffix));
  await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
}
const user = async uid => db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`);
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS '+name); passed++; }
await user(admin);
await test('removing one tariff keeps active billing', async () => {
  await db.exec("delete from generator_monthly_tariffs where id='t1'");
  assert.equal((await db.query('select amount_due from generator_subscribers')).rows[0].amount_due,196000);
});
await test('deleting the final tariff atomically zeroes subscriber, preserving invoices and receipts', async () => {
  await db.exec("delete from generator_monthly_tariffs where id='t2'");
  const row = (await db.query('select amount_due,amount_paid from generator_subscribers')).rows[0];
  assert.deepEqual(row, { amount_due:0, amount_paid:0 });
  assert.equal((await db.query('select paid_amount from generator_invoices')).rows[0].paid_amount,92000);
  assert.equal((await db.query('select amount from generator_audit_logs')).rows[0].amount,92000);
});
await test('empty-state reconciliation is idempotent', async () => {
  const result = (await db.query(`select reconcile_generator_no_tariff_state('${gid}') as state`)).rows[0].state;
  assert.equal(result.updated_subscribers, 0);
});
await test('collector cannot run owner reconciliation', async () => {
  await user(collector);
  await assert.rejects(db.exec(`select reconcile_generator_no_tariff_state('${gid}')`), /FORBIDDEN/);
});
await test('old collector client cannot collect through any write path without pricing', async () => {
  await assert.rejects(db.exec("update generator_subscribers set amount_paid=1000,payment_status='paid' where id='s1'"), /NO_MONTHLY_TARIFF/);
  await assert.rejects(db.exec("update generator_invoices set paid_amount=100000 where id='history'"), /NO_MONTHLY_TARIFF/);
  await assert.rejects(db.exec(`insert into generator_invoices values ('new','${gid}','s1',1000,1000,0,'paid')`), /NO_MONTHLY_TARIFF/);
  await assert.rejects(db.exec(`insert into generator_audit_logs values ('new','${gid}','payment',1000)`), /NO_MONTHLY_TARIFF/);
  assert.equal((await db.query('select count(*)::int as n from generator_audit_logs')).rows[0].n, 1);
});
await test('stale debt cannot return, but profile edits and historical retries remain valid', async () => {
  await db.exec("update generator_subscribers set full_name='Edited', amount_due=196000 where id='s1'");
  assert.deepEqual((await db.query('select full_name,amount_due from generator_subscribers')).rows[0], {full_name:'Edited',amount_due:0});
  await db.exec(`insert into generator_invoices values ('history','${gid}','s1',196000,92000,104000,'partial') on conflict(id) do update set paid_amount=excluded.paid_amount;
    insert into generator_audit_logs values ('history','${gid}','payment',92000) on conflict(id) do nothing;`);
});
await test('adding a tariff enables normal collection again', async () => {
  await user(admin);
  await db.exec(`insert into generator_monthly_tariffs values ('t3','${gid}')`);
  await user(collector);
  await db.exec("update generator_subscribers set amount_paid=1000,payment_status='partial' where id='s1'");
  await db.exec(`insert into generator_audit_logs values ('new','${gid}','payment',1000)`);
  assert.equal((await db.query("select amount_paid from generator_subscribers where id='s1'")).rows[0].amount_paid,1000);
});
await db.close();
console.log(`No-tariff database regression: ${passed} PASS, 0 FAIL`);

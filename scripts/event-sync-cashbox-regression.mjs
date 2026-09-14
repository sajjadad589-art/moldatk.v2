import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
fs.mkdirSync('.test-output', { recursive: true });
for (const name of ['useEventDrivenGeneratorSync','eventSyncScheduler','cashboxCloud','cloudSyncRows']) {
  const source=fs.readFileSync(`src/lib/${name}.ts`,'utf8');
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  fs.writeFileSync(`.test-output/${name}.mjs`,result.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
fs.writeFileSync('.test-output/supabase.mjs','export const supabase = {};');
const { createGeneratorSync } = await import('../.test-output/useEventDrivenGeneratorSync.mjs');
const { createEventSyncScheduler, stableSnapshot, changedRows } = await import('../.test-output/eventSyncScheduler.mjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS '+name); }
class MemoryStorage {
  map = new Map(); getItem(k) { return this.map.get(k) ?? null; } setItem(k,v) { this.map.set(k,String(v)); }
  removeItem(k) { this.map.delete(k); } clear() { this.map.clear(); }
}
globalThis.window = new EventTarget();
globalThis.localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const id = 'test-generator';
const session = { generatorId: id, role: 'generator_admin' };
const sub = { id: 's1', code: '1', fullName: 'Test', tier: 'normal', amperes: 5, paymentStatus: 'unpaid', invoicesHistory: [] };
const tables = ['generator_subscribers','generator_invoices','generator_lines','generator_monthly_tariffs','generator_audit_logs'];
function fixture() {
  localStorage.clear();
  const db = Object.fromEntries(tables.map(t=>[t,[]]));
  db.generator_settings = [{ generator_id:id, specs:{}, invoice_settings:{} }];
  let writes=0, reads=0, reconciles=0, active=0, maxActive=0;
  let fail=false, pause, onWrite, cashbox={ reset_id:null,reset_at:null,balance:null };
  const client = {
    auth: { async getSession() { active++; maxActive=Math.max(maxActive,active); await sleep(1); active--; return {data:{session:{}}}; } },
    async rpc(name) { if (name==='reconcile_generator_monthly_cycle') { reconciles++; onWrite?.(); return {data:{ok:true}}; } return {data:cashbox}; },
    from(table) {
      let kind='select', rows, lo=0,hi=499,ids;
      const q={ select(){return q;}, eq(){return q;}, order(){return q;}, range(a,b){lo=a;hi=b;return q;}, maybeSingle(){kind='single';return q;},
        upsert(r){kind='upsert';rows=r;return q;}, delete(){kind='delete';return q;}, in(_k,v){ids=v;return q;},
        async then(resolve,reject) {
          try {
            if (kind==='upsert'||kind==='delete') {
              writes++; if(fail) throw new Error('simulated disconnect');
              if (pause) await pause();
              if(kind==='delete') db[table]=db[table].filter(r=>!ids.includes(r.id));
              else for(const row of rows) { const n=db[table].findIndex(r=>r.id===row.id); if(n>=0) db[table][n]={...db[table][n],...row}; else db[table].push(row); }
              onWrite?.();
            } else { reads++; if (pause) await pause(); }
            resolve({data:kind==='single'?db[table][0]||null:db[table].slice(lo,hi+1),error:null});
          } catch(error){reject(error);}
        },
      }; return q;
    },
  };
  const sync=createGeneratorSync(session,client,localStorage);
  const listener=e=>sync.local(e); window.addEventListener('moldatk-local-sync',listener);
  return {sync,db,set cashbox(v){cashbox=v;},set fail(v){fail=v;},set pause(v){pause=v;},set onWrite(v){onWrite=v;},
    get writes(){return writes;},get reads(){return reads;},get reconciles(){return reconciles;},get maxActive(){return maxActive;},
    close(){sync.dispose();window.removeEventListener('moldatk-local-sync',listener);}};
}
function local(name,value){localStorage.setItem(`moldatk_${name}_${id}`,JSON.stringify(value));window.dispatchEvent(new Event('moldatk-local-sync'));}
await test('stable snapshot ignores object key order; row delta excludes unchanged rows',async()=>{
  assert.equal(stableSnapshot({b:2,a:1}),stableSnapshot({a:1,b:2}));
  assert.deepEqual(changedRows([{id:'x',a:1}],[{a:1,id:'x'}]),[]);
});
await test('100 events debounce into one flight; completion stays idle',async()=>{
  let calls=0;const scheduler=createEventSyncScheduler(async()=>{calls++;await sleep(5);},{debounceMs:5,cooldownMs:15});
  for(let i=0;i<100;i++)scheduler.request();await sleep(45);assert.equal(calls,1);
  await sleep(45);assert.equal(calls,1);scheduler.dispose();
});
await test('new event during flight queues one follow-up and enforces cooldown',async()=>{
  const times=[];let scheduler; scheduler=createEventSyncScheduler(async()=>{times.push(Date.now()); if(times.length===1){scheduler.request();scheduler.request();}await sleep(5);},{debounceMs:3,cooldownMs:20});
  scheduler.request();await sleep(80);assert.equal(times.length,2);assert.ok(times[1]-times[0]>=20);scheduler.dispose();
});
await test('failed request has no timer-driven retry',async()=>{
  let calls=0;const s=createEventSyncScheduler(async()=>{calls++;throw new Error('offline');},{debounceMs:2,errorCooldownMs:5});
  s.request();await sleep(30);assert.equal(calls,1);await sleep(30);assert.equal(calls,1);s.dispose();
});
await test('bootstrap and remote pulls do not push or reconcile, including cloud notifications',async()=>{
  const f=fixture();f.db.generator_subscribers=[{id:'s1',full_name:'Server',tier:'normal',amperes:5,payment_status:'unpaid'}];
  await f.sync.flush();for(let i=0;i<25;i++)f.sync.remote();await f.sync.flush();
  assert.equal(f.writes,0);assert.equal(f.reconciles,0);assert.equal(JSON.parse(localStorage.getItem(`moldatk_subscribers_${id}`))[0].fullName,'Server');f.close();
});
await test('one local write + own realtime echo settles with no re-push',async()=>{
  const f=fixture();await f.sync.flush();f.onWrite=()=>f.sync.remote();local('subscribers',[sub]);await f.sync.flush();
  assert.equal(f.writes,1);await f.sync.flush();assert.equal(f.writes,1);assert.equal(f.reconciles,0);f.close();
});
await test('changed active tariff reconciles once; subsequent pull never reconciles',async()=>{
  const f=fixture();await f.sync.flush();f.onWrite=()=>f.sync.remote();local('monthly_tariffs',[{id:'2026-09',month:9,year:2026,monthNameAr:'Sep',tiers:[],isCurrentActive:true,createdAt:'2026-09-01T00:00:00Z'}]);
  await f.sync.flush();assert.equal(f.reconciles,1);await f.sync.flush();assert.equal(f.reconciles,1);f.close();
});
await test('edits during pull remain local and are uploaded on next event flight',async()=>{
  const f=fixture();await f.sync.flush();let release;const gate=new Promise(r=>release=r);let paused=false;
  f.pause=async()=>{paused=true;await gate;};const flight=f.sync.flush();while(!paused)await sleep(1);
  local('subscribers',[sub]);release();await assert.rejects(flight,/unsynced_local_changes/);f.pause=null;
  assert.equal(JSON.parse(localStorage.getItem(`moldatk_subscribers_${id}`))[0].fullName,'Test');await f.sync.flush();assert.equal(f.db.generator_subscribers[0].full_name,'Test');f.close();
});
await test('edits during push are not acknowledged or lost',async()=>{
  const f=fixture();await f.sync.flush();local('subscribers',[sub]);let release;const gate=new Promise(r=>release=r);let paused=false;
  f.pause=async()=>{paused=true;await gate;};const flight=f.sync.flush();while(!paused)await sleep(1);
  local('subscribers',[{...sub,fullName:'Second edit'}]);release();await assert.rejects(flight,/unsynced_local_changes/);f.pause=null;
  assert.equal(localStorage.getItem(`moldatk_pending_sync_${id}`),'1');await f.sync.flush();assert.equal(f.db.generator_subscribers[0].full_name,'Second edit');f.close();
});
await test('failed push preserves durable pending data across reload',async()=>{
  const f=fixture();await f.sync.flush();local('subscribers',[sub]);f.fail=true;
  const err=console.error;console.error=()=>{};await assert.rejects(f.sync.flush());console.error=err;
  assert.equal(localStorage.getItem(`moldatk_pending_sync_${id}`),'1');f.fail=false;await f.sync.flush();assert.equal(f.db.generator_subscribers[0].full_name,'Test');f.close();
});
await test('paginated pull includes more than 1000 historical rows',async()=>{
  const f=fixture();f.db.generator_audit_logs=Array.from({length:1205},(_,i)=>({id:String(i),category:'payment',amount:1,timestamp:'2026-09-14T00:00:00Z'}));
  await f.sync.flush();assert.equal(JSON.parse(localStorage.getItem(`moldatk_audit_logs_${id}`)).length,1205);f.close();
});
await test('dispose drops in-flight pull and prevents storage writes',async()=>{
  const f=fixture();let release;const gate=new Promise(r=>release=r);let paused=false;f.pause=async()=>{paused=true;await gate;};
  const flight=f.sync.flush();while(!paused)await sleep(1);f.sync.dispose();release();await flight;
  assert.equal(localStorage.getItem(`moldatk_subscribers_${id}`),null);f.close();
});
await test('parallel flushes share the auth/network flight',async()=>{
  const f=fixture();await Promise.all([f.sync.flush(),f.sync.flush(),f.sync.flush()]);assert.equal(f.maxActive,1);f.close();
});
await test('cloud reset survives refresh and old local timestamp without an upload',async()=>{
  const f=fixture();f.cashbox={reset_id:'reset',reset_at:'2026-09-14T10:00:00Z',balance:0};
  localStorage.setItem(`moldatk_wallet_reset_timestamp_${id}`,'2000-01-01');await f.sync.flush();
  assert.equal(JSON.parse(localStorage.getItem(`moldatk_cashbox_server_${id}`)).balance,0);await f.sync.flush();assert.equal(f.writes,0);f.close();
});
console.log(`Event sync regression: ${passed} PASS, 0 FAIL`);


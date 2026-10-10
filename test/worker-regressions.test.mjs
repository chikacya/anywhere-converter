import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleSetWorkspace } from '../src/ruleset-workspace.mjs';

test('two Worker isolates observe updated and deleted subscriptions after cache expiry without normal DO reads', async () => {
  const a = (await import('../src/worker.mjs?isolate=a')).default;
  const b = (await import('../src/worker.mjs?isolate=b')).default;
  const kv = new Map(), stores = new Map(); let doReads = 0, kvReads = 0;
  const env = { RATE_LIMIT_PER_MINUTE: '-1', RULESET_CACHE_TTL_SECONDS: '30',
    CONVERTER_KV: { get: async k => { kvReads++; return kv.get(k); }, put: async (k,v) => kv.set(k,v), delete: async k => kv.delete(k) },
    RULESET_WORKSPACE: { idFromName: n => n, get: n => ({ fetch: async (url,init) => {
      const payload = JSON.parse(init.body); if (payload.action === 'public') doReads++;
      if (!stores.has(n)) stores.set(n, new Map()); const data = stores.get(n);
      return new RuleSetWorkspace({storage:{get:async k => structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v))}}).fetch(new Request(url,init));
    }}) },
  };
  const call = (w,path,method='GET',body,key) => w.fetch(new Request('https://converter.test'+path,{method,headers:{'content-type':'application/json',...(key ? {authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const created = await (await call(a,'/api/workspaces','POST',{})).json();
    const key = created.editUrl.split('#key=')[1], workspace = created.workspaceId;
    assert(workspace,JSON.stringify(created));
    const path = '/api/workspaces/'+workspace+'/rulesets';
    const first = await (await call(a,path,'POST',{name:'Shared',source:'2,one.example'},key)).json();
    assert(first.ruleSet,JSON.stringify(first)); const id = first.ruleSet.id;
    const sub = '/s/'+workspace+'/'+id+'/rules.arrs';
    assert.match(await (await call(a,sub)).text(),/one.example/);
    const second = await (await call(b,path+'/'+id,'PUT',{name:'Shared',source:'2,two.example',revision:1},key)).json();
    assert.equal(second.ruleSet.revision,2);
    assert.match(await (await call(a,sub)).text(),/one.example/);
    now+=29000;
    const late=await call(a,sub+'?other-client=1');
    assert.match(late.headers.get('cache-control'),/max-age=1,/);
    now+=2000;
    assert.match(await (await call(a,sub+'?other-client=1')).text(),/two.example/);
    const fresh = await call(a,sub); assert.match(await fresh.text(),/two.example/);
    assert.equal(fresh.headers.get('x-ruleset-revision'),'2'); assert.equal(doReads,0); assert(kvReads>0);
    now+=2000;
    const conditional=await a.fetch(new Request('https://converter.test'+sub,{headers:{'if-none-match':fresh.headers.get('etag')}}),env);
    assert.equal(conditional.status,304); assert.equal(conditional.headers.get('age'),'2');
    await call(b,path+'/'+id,'DELETE',undefined,key); now+=31000;
    assert.equal((await call(a,sub)).status,404); assert.equal(doReads,1);
  } finally { Date.now=realNow; }
});

test('Worker API supports optional AMOD, deep links and fallback snapshots', async () => {
  const w=(await import('../src/worker.mjs?isolate=amod')).default;
  const response=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:'#!name=Bundle\n[Rule]\nDOMAIN,ads.example,REJECT\n[Rewrite]\n^https://ads.example/ reject',outputFormat:'amod'})}),{RATE_LIMIT_PER_MINUTE:'-1'});
  assert.equal(response.status,200); const value=await response.json();
  assert.equal(value.files[0].type,'amod');
  assert.match(JSON.stringify(value),/add-module/);
  const snapshot=await w.fetch(new Request(value.files[0].url),{RATE_LIMIT_PER_MINUTE:'-1'});
  assert.equal(snapshot.status,200);assert.match(await snapshot.text(),/\[Module\]/);
});

test('AMOD dynamic URL and import deep link round-trip the optional format',async()=>{
  const w=(await import('../src/worker.mjs?isolate=dynamic-amod')).default;
  const env={RATE_LIMIT_PER_MINUTE:'-1'};const nativeFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('#!name=Dynamic\n[Rule]\nDOMAIN,ad.example,REJECT\n[Rewrite]\n^https://ad.example/ reject', {headers:{'content-type':'text/plain'}});
  try {
    const response=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://upstream.example/dynamic.module',outputFormat:'amod'})}),env);
    assert.equal(response.status,200);const value=await response.json();
    assert.equal(value.files[0].type,'amod');assert.match(value.dynamicImportUrl,/^anywhere:\/\/add-module/);
    assert.match(value.files[0].url,/outputFormat=amod/);
    const raw=await w.fetch(new Request(value.files[0].url),env);assert.equal(raw.status,200);assert.match(await raw.text(),/\[Routing\]/);
    const deepLink=await w.fetch(new Request('https://converter.test/sub/deeplink?url=https%3A%2F%2Fupstream.example%2Fdynamic.module&outputFormat=amod&format=text'),env);
    assert.match(await deepLink.text(),/^anywhere:\/\/add-module/);
  } finally {globalThis.fetch=nativeFetch;}
});

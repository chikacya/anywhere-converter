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

test('Worker API defaults plugins to AMOD, including snapshot import links', async () => {
  const w=(await import('../src/worker.mjs?isolate=amod')).default;
  const response=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:'#!name=Bundle\n[Rule]\nDOMAIN,ads.example,REJECT\n[Rewrite]\n^https://ads.example/ reject'})}),{RATE_LIMIT_PER_MINUTE:'-1'});
  assert.equal(response.status,200); const value=await response.json();
  assert.equal(value.files[0].type,'amod');
  assert.match(JSON.stringify(value),/add-module/);
  const snapshot=await w.fetch(new Request(value.files[0].url),{RATE_LIMIT_PER_MINUTE:'-1'});
  assert.equal(snapshot.status,200);assert.match(await snapshot.text(),/\[Module\]/);
});

test('module growth returns an explicit error; fallback and old standalone subscription URLs stay usable',async()=>{
  const w=(await import('../src/worker.mjs?isolate=growing-amod')).default;
  const env={RATE_LIMIT_PER_MINUTE:'-1',FETCH_CACHE_TTL_SECONDS:'-1',DYNAMIC_CACHE_TTL_SECONDS:'-1'};
  const nativeFetch=globalThis.fetch;
  let source='#!name=Growing\n[Rewrite]\n^https://ad.example/ reject\n[MITM]\nhostname=ad.example';
  globalThis.fetch=async()=>new Response(source);
  const api=()=>w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://upstream.example/growing.module'})}),env);
  try {
    const initial=await(await api()).json();
    assert.equal(initial.files[0].type,'amod');
    const moduleURL=initial.files[0].url;
    source='#!name=Growing\n[Rewrite]\n'+Array.from({length:9000},(_,i)=>`^https://ad.example/${i} reject`).join('\n')+'\n[MITM]\nhostname=ad.example';
    const oversized=await w.fetch(new Request(moduleURL),env);
    assert.equal(oversized.status,422);assert.equal(oversized.headers.get('cache-control'),'no-store');
    const failure=await oversized.json();assert.equal(failure.error,'module_limit_exceeded');
    assert(failure.standaloneFiles.length);assert.match(failure.importUrl,/add-rule-set/);
    const converted=await(await api()).json();assert.equal(converted.files[0].type,'amrs');
    const fallbackURL=converted.files[0].url;assert.match(fallbackURL,/outputFormat=standalone/);
    source='#!name=Growing\n[Rewrite]\n^https://ad.example/ reject\n[MITM]\nhostname=ad.example';
    for(const rawURL of [fallbackURL, failure.standaloneFiles[0].url,
      'https://converter.test/sub/mitm.amrs?url=https%3A%2F%2Fupstream.example%2Fgrowing.module',
      fallbackURL.replace('outputFormat=standalone','outputFormat=amod')]) {
      const response=await w.fetch(new Request(rawURL),env);
      assert.equal(response.status,200);const content=await response.text();
      assert.match(content,/^hostname = ad.example$/m);assert(!content.includes('[Module]'));
    }
    const recovered=await w.fetch(new Request(moduleURL),env);assert.equal(recovered.status,200);
    assert.match(await recovered.text(),/\[Module\]/);
    const rules=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:'DOMAIN,example.com'})}),env);
    assert.equal((await rules.json()).files[0].type,'arrs');
  } finally {globalThis.fetch=nativeFetch;}
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

test('Worker accepts a remote QX JS URL and preserves hostnames across dynamic conversion',async()=>{
  const w=(await import('../src/worker.mjs?isolate=qx')).default, nativeFetch=globalThis.fetch;
  const url='https://scripts.example/test.js';let fetches=0;
  const js='/*\n[rewrite_local]\n^https://example.com/ url script-response-body '+url+'\n[mitm]\nhostname=example.com\n*/\n$done({body:$response.body.replace(/ad/gi,"ok")});';
  globalThis.fetch=async()=>{fetches++;return new Response(js,{headers:{'content-type':'text/javascript'}});};
  const env={RATE_LIMIT_PER_MINUTE:'-1'};
  try {
    const response=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})}),env);
    assert.equal(response.status,200);const result=await response.json();
    assert.deepEqual(result.hostnames,['example.com']);assert.equal(result.summary.hostnameCount,1);assert.equal(result.summary.skipped,0);
    const raw=await w.fetch(new Request(result.files[0].url),env);assert.equal(raw.status,200);assert.match(await raw.text(),/^hostname = example.com$/m);
    assert.equal(fetches,1);
  } finally {globalThis.fetch=nativeFetch;}
});

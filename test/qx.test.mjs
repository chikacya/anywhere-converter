import test from 'node:test';
import assert from 'node:assert/strict';
import { convertAny, convertAnyAsync, convertModule, parseModule, detectSourceKind, internals, validateAnywhereOutput } from '../src/core.mjs';
import { runConverted } from './runtime-harness.mjs';

const url='https://scripts.example/test.js';
const rewrite=(action='script-response-body')=>`[rewrite_local]\n^https://example.com/ url ${action} ${url}\n[mitm]\nhostname=example.com`;
const convertJS=(source,action='script-response-body')=>convertAny(rewrite(action),{fetchScripts:true,scriptTextByURL:{[url]:source}});

test('case-insensitive sections preserve explicit hostname and wildcard coverage',()=>{
  for(const title of ['MITM','mitm','MiTm']){
    const result=convertAny(`[uRl ReWrItE]\n^https://api.example.com/ https://target.example/$1 header\n[${title}]\nHostName=%APPEND% *.example.com, example.com, b.example.net`);
    assert.deepEqual(result.hostnames,['example.com','b.example.net','api.example.com']);
    assert.match(result.files[0].content,/hostname = example.com, b.example.net/);
  }
});

test('QX without sections, MITM options and filters retains source scope',()=>{
  const source=';disabled\nhostname=*.example.com\n^https://example.com/ad url reject-200\nhost-suffix,ads.example, reject';
  assert.equal(detectSourceKind(source),'module');const result=convertAny(source);
  assert.equal(result.files[0].type,'amod');assert.match(result.files[0].content,/\[Routing\]/);assert.equal(result.hostnames[0],'example.com');assert.equal(result.report.skipped,0);
  const expanded=convertAny('hostname=tnc*-*.example.net\n^https://tnc.*example.net/ url reject-200');
  assert(!expanded.hostnames.includes('tnc-.example.net'));
  assert(expanded.diagnostics.some(d=>d.code==='hostname-wildcard-expanded'));
  const missing=convertAny('^https://.*/ad url reject-200');
  assert.equal(missing.hostnames.length,0);assert(missing.diagnostics.some(d=>d.code==='mitm-hostname-missing'));
});

test('QX explicit actions retain redirect capture, body regex and empty reject body',async()=>{
  const source='[rewrite_local]\n^https://example.com/(.*) url 302 https://next.example/$1\n^https://example.com/a.png url reject-200\n^https://example.com/data url response-body "ad":true response-body "ad":false\n[mitm]\nhostname=example.com';
  const result=convertAny(source), content=result.files[0].content;
  assert.match(content,/1, https:\/\/next.example\/\$1/);
  const response=await runConverted(result,'',{}, {phase:'request',url:'https://example.com/a.png'});
  assert.equal(response.responses[0].body,'');assert.equal(response.responses[0].status,200);assert(!content.includes('a.png, 3'));
  const body=content.split('\n').find(x=>/^1, 4,/.test(x));assert.deepEqual(internals.parseCsv(body).slice(3),['"ad":true','"ad":false']);
  assert.deepEqual(validateAnywhereOutput(result.files[0]),[]);
});

test('QX bare reject and unsupported whole-head regex are diagnosed, never URL-rewritten',()=>{
  const result=convertAny('hostname=example.com\n^https://example.com/ url reject\n^https://example.com/ url request-header a request-header b\n[task_local]\n0 0 * * * other.js');
  for(const code of ['qx-reject-not-equivalent','qx-rewrite-unsupported','qx-section-unsupported'])assert(result.diagnostics.some(d=>d.code===code),code);
  assert(!result.files.some(f=>f.content.includes(', 0, url')));
});

test('embedded QX JS binds only its own script URL and never downloads itself',async()=>{
  const js=`/*\n[rewrite_local]\n^https://example.com/ url script-response-body ${url}\n[mitm]\nhostname=example.com\n*/\n$done({body:$response.body.replace(/ad/g,"ok")});`;
  let fetches=0;const result=await convertAnyAsync(js,{sourceUrl:url,fetchText:async()=>{fetches++;throw Error('must not fetch self');}});
  assert.equal(fetches,0);assert.equal(result.files.length,1);assert.equal((await runConverted(result,'ad')).text,'ok');
  assert.equal(convertAny(js,{sourceUrl:'https://other.example/not-this.js'}).files.length,0);
  const missing=convertAny('$done({body:"changed"});');
  assert(missing.diagnostics.some(d=>d.code==='script-metadata-required'));assert.equal(missing.files.length,0);
});

test('QX JS header with multiple unrelated scripts requires unambiguous source URL',()=>{
  const js=`/*\n^https://example.com/a url script-response-body ${url}\n^https://example.com/b url script-response-body https://other.example/b.js\n*/\n$done({body:"changed"});`;
  assert.equal(parseModule(js).items.length,0);
  assert.equal(parseModule(js,{sourceUrl:url}).items.length,1);
});

test('QX script downloading uses existing fetch dedupe and preserves JS behavior',async()=>{
  let calls=0;const config=rewrite()+'\n[rewrite_local]\n^https://example.com/feed url script-response-body '+url;
  const result=await convertAnyAsync(config,{fetchText:async()=>{calls++;return '$done({body:$response.body.replace(/ad/gi,"ok")});';}});
  assert.equal(calls,1);assert.equal((await runConverted(result,'AD ad')).text,'ok ok');
});

test('QX bodyBytes adapter handles ArrayBuffer without decoding binary',async()=>{
  const result=convertJS('const b=new Uint8Array($response.bodyBytes);b[0]=7;$done({bodyBytes:b.buffer});');
  const actual=await runConverted(result,[255,128,0]);assert.deepEqual([...actual.bytes],[7,128,0]);assert.equal(actual.decodes,0);
});

test('QX response head changes are blocked rather than silently discarded',()=>{
  for(const source of ['$done({headers:{"X-Test":"1"},body:"changed"});','$response.headers["X-Test"]="1";$done({body:"changed"});']){
    const result=convertJS(source,'script-response-header');
    assert(result.diagnostics.some(d=>d.code==='qx-response-head-unsupported'));
    assert.equal(result.files.length,0);
  }
});

test('response scripts cannot mistake response headers or bytes for original request data',async()=>{
  for(const source of ['const h=$request.headers;$done({body:JSON.stringify(h)});','const b=$request.body;$done({body:b});','void globalThis;const b=$request.bodyBytes;$done({bodyBytes:b});']){
    const result=convertJS(source);assert(result.diagnostics.some(d=>d.code==='script-request-context-sample-required'));
    const actual=await runConverted(result,'original');assert.equal(actual.text,'original');assert(actual.errors.some(e=>e.includes('Original request head/body')));
  }
});

test('request JS header assignment inserts missing fields and replaces duplicates',()=>{
  const result=convertJS('$request.headers["x-test"]="first";$request.headers["x-test"]="new";$done($request);','script-request-header');
  const operations=result.files[0].content.split('\n').filter(x=>/^0, [12],/.test(x)).map(x=>internals.parseCsv(x));
  for(const original of [[],[['x-test','old'],['X-Test','duplicate']]]){
    let headers=original;
    for(const [,op,,name,value] of operations){if(op==='2')headers=headers.filter(([k])=>k.toLowerCase()!==name);else if(op==='1')headers.push([name,value]);}
    assert.deepEqual(headers,[['x-test','new']]);
  }
  const framing=convertJS('$request.headers["Content-Length"]="1";$done($request);','script-request-header');
  assert(!framing.diagnostics.some(d=>d.code==='script-request-lift'));
});

test('native JSON retains repeated mutations after an intervening statement',()=>{
  const result=convertJS('const o=JSON.parse($response.body);o.ad=true;delete o.ad;o.ad=true;$done({body:JSON.stringify(o)});');
  const rows=result.files[0].content.split('\n').filter(x=>/^1, 5,/.test(x)).map(x=>internals.parseCsv(x).slice(3));
  assert.deepEqual(rows,[['add','$["ad"]','true'],['delete','$["ad"]'],['add','$["ad"]','true']]);
});

test('QX script echo maps status line and headers to request respond',async()=>{
  const result=convertJS('$done({status:"HTTP/1.1 201 Created",headers:{"Content-Type":"application/json"},body:"{}"});','script-echo-response');
  assert.equal(result.report.skipped,0,JSON.stringify(result.diagnostics));
  const actual=await runConverted(result,'',{}, {phase:'request'});
  assert.equal(actual.responses[0].status,201);assert.equal(actual.responses[0].body,'{}');assert.equal(actual.responses[0].headers['Content-Type'],'application/json');
});

test('QX task fetch, platform detection and preferences use the compatibility runtime',async()=>{
  const source='if(!("$task" in globalThis)||typeof $loon!=="undefined")throw Error("platform");$prefs.setValueForKey("value","key");$prefs.removeValueForKey("key");$task.fetch({url:"https://side.example/",method:"POST",bodyBytes:new Uint8Array([1,2]).buffer}).then(r=>$done({bodyBytes:new Uint8Array(r.bodyBytes)}));';
  const result=convertJS(source);const trace=[];
  const actual=await runConverted(result,'original',{store:{set:k=>trace.push('set:'+k),delete:k=>trace.push('delete:'+k)},http:{request:async req=>{assert.equal(req.body.byteLength,2);return{status:200,headers:[],body:new Uint8Array([255,128])};}}});
  assert.deepEqual([...actual.bytes],[255,128]);assert.deepEqual(trace,['set:key','delete:key']);assert.equal(actual.decodes,0);assert.deepEqual(actual.errors,[]);
});

test('QX jq IN exclusion and simple field exclusion use native operations',()=>{
  const source='hostname=example.com\n^https://example.com/a url jsonjq-response-body \'.data |= map(select(.kind | IN("ad", "banner") | not))\'\n^https://example.com/b url jsonjq-response-body \'.data |= map(select(.kind != "ad"))\'';
  const result=convertAny(source);assert.equal(result.report.skipped,0);assert.equal(result.report.scriptMetrics.scriptRuleCount,0);
  const rows=result.files[0].content.split('\n').filter(x=>/^1, 5,/.test(x)).map(x=>internals.parseCsv(x).slice(3));
  assert.deepEqual(rows,[['remove-where-field-in','$.data','kind','["ad","banner"]'],['remove-where-field-in','$.data','kind','["ad"]']]);
});

test('AMOD preserves native one-line description and MITM hostnames',()=>{
  const result=convertAny('#!name=Demo\n#!desc=上游说明\n[rewrite_local]\n^https://example.com/ url reject-200\n[mitm]\nhostname=example.com',{outputFormat:'amod'});
  assert.equal(result.files[0].type,'amod');assert.match(result.files[0].content,/^description = 上游说明$/m);assert.match(result.files[0].content,/^hostname = example.com$/m);
});

test('same source with constant and preserved parameters isolates body and full runner signatures',async()=>{
  const source='#!arguments=choice:default\n[Script]\na=type=http-response,pattern=^https://example.com/,script-path=https://scripts.example/a.js,argument=constant\nb=type=http-response,pattern=^https://example.com/feed,script-path=https://scripts.example/a.js,argument={{{choice}}}\n[MITM]\nhostname=example.com';
  const result=convertAny(source,{preserveParameters:true,fetchScripts:true,scriptTextByURL:{'https://scripts.example/a.js':'$done({body:$response.body+"|"+$argument});'}});
  const actual=await runConverted(result,'original',{params:{get:()=> 'dynamic'}});
  assert.equal(actual.text,'original|constant|dynamic');
});

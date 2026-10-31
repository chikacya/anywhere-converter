import test from 'node:test';
import assert from 'node:assert/strict';
import {convertAny,convertAnyAsync,parseModule,validateAnywhereOutput,internals} from '../src/core.mjs';
import {parseLoonV2} from '../src/loon.mjs';
import {runConverted} from './runtime-harness.mjs';
const source=lines=>'#!name=Loon new\n[Rewrite]\n'+lines+'\n[MITM]\nhostname=example.com';
const convert=(lines,options={})=>convertAny(source(lines),options);
const rows=result=>result.files[0]?.content.split('\n').filter(x=>/^[01],/.test(x)).map(internals.parseCsv)||[];
const url='https://scripts.example/test.js';
const scripts=(lines,options={})=>convertAny('[Script]\n'+lines+'\n[MITM]\nhostname=example.com',{fetchScripts:true,scriptTextByURL:{[url]:'$done({body:JSON.stringify($argument)});'},...options});

test('Loon v2 parser respects raw/quoted/regex boundaries and validates syntax',()=>{
  const parsed=parseLoonV2('response if ${url} ~= /a[|]b/ then response.body.mock("json", `{"pipe":"| then with # // ${literal}","tick":"``"}`, 200)');
  assert(!parsed.error,parsed.message);assert.equal(parsed.actions[0].args[1].value,'{"pipe":"| then with # // ${literal}","tick":"`"}');
  for(const line of ['request if ${url} != "x" then reject(200)','request if ${url} ~= /x/g then reject(200)','request if ${url} ~= /x/ then reject(200) junk'])assert(parseLoonV2(line).error,line);
});

test('native headers retain batch order, set delete/add semantics and old/new mixture',()=>{
  const r=convert('^https://example.com header-add X-Old old\nrequest if ${url} ~= /^https:\\/\\/example\\.com/ then request.header.set(["X-A", "X-B"], ["1", "2"]) | request.header.del("Cookie")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.deepEqual(rows(r).map(x=>x.slice(1)),[
    ['1','^https://example.com','X-Old','old'],['2','^https://example\\.com','X-A'],['1','^https://example\\.com','X-A','1'],
    ['2','^https://example\\.com','X-B'],['1','^https://example\\.com','X-B','2'],['2','^https://example\\.com','Cookie']]);
  assert.deepEqual(validateAnywhereOutput(r.files[0]),[]);
});

test('native JSON supports typed values and paired batch paths, flags on URL',()=>{
  const r=convert('response if ${url} ~= /example/i then response.json.add(["data.a","data.b"],[1,true]) | response.json.delete("data.ad")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.deepEqual(rows(r).filter(x=>x[1]==='5').map(x=>x.slice(2)),[['(?i)example','add','data.a','1'],['(?i)example','add','data.b','true'],['(?i)example','delete','data.ad']]);
  assert.deepEqual(validateAnywhereOutput(r.files[0]),[]);
});

test('complex response conditions keep status/header/method and call Anywhere.json',async()=>{
  const r=convert('response if ${url} ~= /example/ && ${request.method} == "GET" && (${response.status} == 200 || ${response.status} == 201) && ${response.header[\'Content-Type\']} ~= /json/i then response.json.replace("data.vip", true)');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  const edit={json:{replace:(bytes,path,value)=>new TextEncoder().encode(JSON.stringify({path,value}))}};
  const match=await runConverted(r,'{}',edit,{headers:[['content-type','application/json']]});
  assert.deepEqual(JSON.parse(match.text),{path:'data.vip',value:true});
  const miss=await runConverted(r,'{}',edit,{status:403,headers:[['content-type','application/json']]});assert.equal(miss.text,'{}');
});

test('raw mock preserves literal interpolation and JSON content type/status',async()=>{
  const r=convert('response if ${url} ~= /example/ then response.body.mock("json", `{"v":"${literal}","x":"| then # //"}`, 404) | response.header.set("X-Test","ok")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  const actual=await runConverted(r,'',{}, {phase:'request'});
  assert.equal(actual.responses[0].status,404);assert.deepEqual(JSON.parse(new TextDecoder().decode(actual.responses[0].body)),{v:'${literal}',x:'| then # //'});
  assert(actual.responses[0].headers.some(([k,v])=>k==='X-Test'&&v==='ok'));
});

test('mock header add appends rather than silently replacing duplicates',async()=>{
  const r=convert('response if ${url} ~= /example/ then response.header.add("X-Test","a") | response.body.mock("text","ok") | response.header.add("X-Test","b")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  const actual=await runConverted(r,'',{}, {phase:'request'});
  assert.deepEqual(Array.from(actual.responses[0].headers.filter(([k])=>k==='X-Test'),([,v])=>v),['a','b']);
});

test('reject keeps arbitrary status and body, not an empty native 200',async()=>{
  const r=convert('request if ${url} ~= /example/ then reject(451,"blocked")');
  assert.equal(r.report.skipped,0);const actual=await runConverted(r,'',{}, {phase:'request'});
  assert.equal(actual.responses[0].status,451);assert.equal(new TextDecoder().decode(actual.responses[0].body),'blocked');
});

test('unrepresentable conditions/actions reject the entire line, not partial pipeline',()=>{
  for(const text of [
    'request if ${url} ~= "example" then reject(200)',
    'request if ${url} ~= /example/ then reject([200],["ok"])',
    'response if ${url} ~= /example/ && ${request.header[\'Accept\']} == "json" then response.json.delete("ad")',
    'request if ${request.method} == "POST" then request.header.set("X-A","1")',
    'response if ${url} ~= /example/ then response.header.replace("X-A",/old/,"new")',
    'response if ${url} ~= /example/ then response.json.delete("ad") | response.header.set("X-A","1")',
    'response if ${url} ~= /example/ then response.json.delete(["a","b"]) | response.json.add(["x"],[1,2])',
    'response if ${url} ~= /example/ then response.body.mock_file("json","local.json")',
    'request if ${url} ~= /example/ then request.header.set("Content-Length","0")',
  ]){const r=convert(text);assert.equal(r.report.skipped,1,text);assert.equal(r.files.length,0,text);assert(r.diagnostics.some(d=>d.code==='loon-rewrite-unsupported'));}
});

test('captures retain native URL $n and cannot come from optional OR branch',()=>{
  const r=convert('request if ${url} ~= /^https:\\/\\/example\\.com\\/item\\/(\\d+)/ as item then url.replace("https://new.example/${item.1}")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));assert(rows(r).some(x=>x.includes('https://new.example/$1')));
  const bad=convert('response if ${url} ~= /item\\/(\\d+)/ as item || ${response.status} == 200 then response.json.add("id","${item.1}")');assert.equal(bad.report.skipped,1);
});

test('Script v2 accepts binary options and preserves null/object argument types',async()=>{
  const r=scripts(`response if \${url} ~= /example/i then script("${url}") with requires_body=true, binary_body_mode=true`);
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));assert.equal((await runConverted(r,'{}')).text,'null');
  const plugin='[Argument]\nregion=select,"CN","US"\nlevel=select,1,2,type=number\nenabled=switch,true\n[Script]\nresponse if ${url} ~= /example/ then script("'+url+'", {${region}, ${level}, ${enabled}}) with requires_body=true\n[MITM]\nhostname=example.com';
  const result=convertAny(plugin,{fetchScripts:true,scriptTextByURL:{[url]:'$done({body:JSON.stringify($argument)});'},preserveParameters:true});
  assert.equal(result.report.skipped,0,JSON.stringify(result.diagnostics));
  const actual=await runConverted(result,'{}',{params:{get:k=>({region:'US',level:'2',enabled:'false'})[k]}});
  assert.deepEqual(JSON.parse(actual.text),{region:'US',level:2,enabled:false});
});

test('new Script selects first complete match including fallback and mixed legacy',async()=>{
  const r=scripts(`response if \${url} ~= /example/ && \${response.status} == 201 then script("${url}","first") with requires_body=true\nresponse if \${url} ~= /example/ then script("${url}","fallback") with requires_body=true\nhttp-response ^https://example.com script-path=${url}, requires-body=true, argument=legacy`);
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.equal((await runConverted(r,'{}')).text,'"fallback"');
  assert.equal((await runConverted(r,'{}',{}, {status:201})).text,'"first"');
});

test('parameters are data, never reparsed or expanded twice; escapes stay literal',async()=>{
  const plugin='[Argument]\ntext=input,default\n[Script]\nresponse if ${url} ~= /example/ then script("'+url+'", "${text}") with requires_body=true\n[MITM]\nhostname=example.com';
  const payload='${url}" then script("evil") |';
  const r=convertAny(plugin,{arguments:{text:payload},fetchScripts:true,scriptTextByURL:{[url]:'$done({body:$argument});'}});
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));assert.equal((await runConverted(r,'{}')).text,payload);
});

test('unsupported triggers and unsafe response guard do not fetch or execute scripts',async()=>{
  let fetches=0;
  const r=await convertAnyAsync('[Script]\ncron "0 8 * * *" then script("https://scripts.example/cron.js")\nresponse if ${response.status} == 200 then script("https://scripts.example/test.js")',{fetchText:async()=>{fetches++;return '$done({});';}});
  assert.equal(fetches,0);assert.equal(r.report.skipped,2);assert.equal(r.files.length,0);
  assert(parseModule('[Script]\ngeneric then script("local.js")').items[0].loonV2.error);
});

test('missing plugin values are diagnosed rather than guessed as empty string or zero',()=>{
  const plugin='[Argument]\nlevel=input,type=number,tag=级别\n[Script]\nresponse if ${url} ~= /example/ then script("'+url+'", {${level}}) with requires_body=true';
  const r=convertAny(plugin,{fetchScripts:true,scriptTextByURL:{[url]:'$done({body:JSON.stringify($argument)});'}});
  assert.equal(r.report.skipped,1);assert(r.diagnostics.some(d=>/缺少实际值/.test(d.message)));
});

test('Script header absence differs from empty value; OR URL guards stay mandatory',async()=>{
  const r=scripts(`response if (\${url} ~= /example/ || \${url} ~= /another/) && \${response.header['X-Optional']} == null then script("${url}","missing") with requires_body=true\nresponse if \${url} ~= /example/ then script("${url}","exists") with requires_body=true`);
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.equal((await runConverted(r,'{}')).text,'"missing"');
  assert.equal((await runConverted(r,'{}',{}, {headers:[['x-optional','']]})).text,'"exists"');
});

test('dynamic enables and condition params remain typed and can change at runtime',async()=>{
  const plugin='[Argument]\nenabled=switch,true\n[Script]\nresponse if ${url} ~= /example/ then script("'+url+'", "enabled") with enable=${enabled}, requires_body=true\nresponse if ${url} ~= /example/ then script("'+url+'", "fallback") with requires_body=true\n[MITM]\nhostname=example.com';
  const r=convertAny(plugin,{preserveParameters:true,fetchScripts:true,scriptTextByURL:{[url]:'$done({body:$argument});'}});
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.equal(rows(r).filter(x=>x[0]==='1'&&x[1]==='100').length,1,'same-gate conditions must share a selector');
  for(const [enabled,expected] of [['true','enabled'],['false','fallback']])assert.equal((await runConverted(r,'{}',{params:{get:()=>enabled}})).text,expected);
});

test('conditional body replacement expands $0/$1 and executes pipeline in order',async()=>{
  const r=convert('response if ${url} ~= /example/ && ${response.status} == 200 then response.body.replace(/a(\\d)/,"[$0:$1]") | response.body.replace(/\\[/,"<")');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  assert.equal((await runConverted(r,'a1 a2')).text,'<a1:1] <a2:2]');
});

test('unsafe Script options, duplicate/object params and dynamic paths have explicit diagnostics',()=>{
  for(const line of [
    `response if \${url} ~= /example/ then script("${url}") with unknown=true`,
    `response if \${url} ~= /example/ then script("${url}") with requires_body=true,requires_body=false`,
    `response if \${url} ~= /example/ then script("${url}", {})`,
    `response if \${url} ~= /example/ then script("${url}", null)`,
    `response if \${url} ~= /example/ then script("${url}") with requires_body="true"`,
    'response if ${url} ~= /example/ then script("${region}.js")',
  ]){const r=scripts(line);assert.equal(r.report.skipped,1,line);assert(r.diagnostics.some(d=>d.level==='warning'&&d.code.startsWith('loon-')));}
});

test('native URL exact query boundary is not widened; native regex flags retain validation',()=>{
  const r=convert('response if ${url} ~= /^https:\\/\\/example\\.com\\/api\\?/i then response.json.delete("ad")');
  assert.equal(r.report.skipped,0);assert.equal(rows(r).find(x=>x[1]==='5')[2],'(?i)^https://example\\.com/api\\?');
  assert.deepEqual(validateAnywhereOutput(r.files[0]),[]);assert(r.hostnames.includes('example.com'));
});

test('Worker async downloading supports v2 Script and preserves object parameters',async()=>{
  const w=(await import('../src/worker.mjs?isolate=loon-v2')).default;
  const fetchOriginal=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('$done({body:JSON.stringify($argument)});');};
  try{
    const input={source:'[Argument]\nlevel=input,2,type=number\n[Script]\nresponse if ${url} ~= /^https:\\/\\/example\\.com/ then script("'+url+'", {${level}}) with requires_body=true\n[MITM]\nhostname=example.com',preserveParameters:true};
    const response=await w.fetch(new Request('https://converter.test/api/convert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}),{RATE_LIMIT_PER_MINUTE:'-1'});
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.files[0].type,'amod');assert.equal(result.summary.skipped,0,JSON.stringify(result.diagnostics));assert.equal(result.summary.validationErrors,0);assert.equal(calls,1);
    assert.equal((await runConverted(result,'{}',{params:{get:()=> '3'}})).text,'{"level":3}');
  }finally{globalThis.fetch=fetchOriginal;}
});

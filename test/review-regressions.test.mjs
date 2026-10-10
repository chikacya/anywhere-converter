import test from "node:test";
import assert from "node:assert/strict";
import { convertAny, convertModule, internals, validateAnywhereOutput } from "../src/core.mjs";
import { moduleBudget, packageAmod } from "../src/amod.mjs";
import { convertScript, runConverted, runUpstream } from "./runtime-harness.mjs";

test("whole-program lift preserves root assignment and statement order", () => {
  const result = convertScript('const o=JSON.parse($response.body); o.ad=true; delete o.ad; o.newField=true; $done({body:JSON.stringify(o)});');
  const rows = result.files[0].content.split("\n").filter(x => /^1, 5,/.test(x)).map(x => internals.parseCsv(x).slice(3));
  assert.deepEqual(rows, [["add", '$["ad"]', "true"], ["delete", '$["ad"]'], ["add", '$["newField"]', "true"]]);
});

for (const [name, source] of Object.entries({
  sort: 'let o=JSON.parse($response.body);delete o.ad;o.items.sort();$done({body:JSON.stringify(o)});',
  nested: 'let o=JSON.parse($response.body);delete o.ad;o.data.enabled=true;$done({body:JSON.stringify(o)});',
  guard: 'let o=JSON.parse($response.body);if($request.url.includes("/feed")&&o.flag){delete o.ad;} $done({body:JSON.stringify(o)});',
  branch: 'let o=JSON.parse($response.body);if($request.url.includes("/feed")){delete o.ad;}else{o.flag=true;} $done({body:JSON.stringify(o)});',
  flags: '$response.body=$response.body.replace(/ad/i,"X");$done({body:$response.body});',
  once: '$response.body=$response.body.replace(/ad/,"X");$done({body:$response.body});',
  substitution: '$response.body=$response.body.replace(/ad/g,"$&X");$done({body:$response.body});',
  shadow: 'const JSON="shadow";let o=JSON.parse($response.body);delete o.ad;$done({body:JSON.stringify(o)});',
  arrayIndex: 'let o=JSON.parse($response.body);o["0"]=true;$done({body:JSON.stringify(o)});',
  arrayLength: 'let o=JSON.parse($response.body);o.length=0;$done({body:JSON.stringify(o)});',
  spread: 'let o=JSON.parse($response.body);delete o.ad;$done({...{body:JSON.stringify(o)}});',
})) test("retains full upstream behavior: " + name, async () => {
  const result = convertScript(source);
  assert(result.files[0].content.includes("1, 100,"));
  for (const input of ['{"ad":1,"items":[3,1,2],"data":{},"flag":true}', '{"ad":1,"items":[2,1]}', 'AD ad ad', 'invalid JSON']) {
    assert.equal((await runConverted(result, input)).text, await runUpstream(source, input));
  }
});

test("plain global literal replace still uses native body-replace", () => {
  const r = convertScript('$response.body=$response.body.replace(/ad/g,"X");$done({body:$response.body});');
  assert(r.files[0].content.includes("1, 4,"));
});

test("URL query mutations and source reassignment match browser URL", async () => {
  const source = 'const u=new URL("https://example.com/path?a=1&a=2#h");u.searchParams.set("a","x y");u.searchParams.append("b","~");u.searchParams.delete("b");u.pathname="/next";u.search="q=hello+world";$done({body:u.href+"|"+u.searchParams.get("q")});';
  const actual = await runConverted(convertScript(source), "");
  assert.equal(actual.text, "https://example.com/next?q=hello+world#h|hello world");
  const relative = await runConverted(convertScript('const u=new URL("/next?a=1","https://example.com/old");u.searchParams.set("a","2");$done({body:u.toString()});'), "");
  assert.equal(relative.text, "https://example.com/next?a=2");
  const host=await runConverted(convertScript('const u=new URL("https://OLD.example:443/a");u.hostname="new.example";u.port="8443";u.href="http://NEXT.example:80/b";$done({body:u.href+"|"+u.origin});'), "");
  assert.equal(host.text,"http://next.example/b|http://next.example");
  const unsupported=await runConverted(convertScript('const u=new URL("https://user:pass@example.com/a");$done({body:u.href});'), "original");
  assert.equal(unsupported.text,"original"); assert(unsupported.errors.some(x=>x.includes('authority')));
});

test("timer delay is diagnosed and fails unchanged, zero delay settles", async () => {
  const result = convertScript('setTimeout(()=>$done({body:"changed"}),10000);');
  assert(result.diagnostics.some(x => x.code === "script-timer-sample-required"));
  const actual = await runConverted(result, "original");
  assert.equal(actual.text, "original"); assert(actual.errors.some(x => x.includes("no native timers")));
  assert.equal((await runConverted(convertScript('setTimeout(()=>$done({body:"changed"}),0);'), "original")).text, "changed");
});

test("lazy binary body remains byte-exact on exception", async () => {
  const result = convertScript('const b=$response.body;b[0]=7;throw new Error("fail");', { binary: true });
  const actual = await runConverted(result, [255, 128, 0]);
  assert.deepEqual([...actual.bytes], [255, 128, 0]); assert.equal(actual.decodes, 0);
});

test('body-only adapter is small and retains binary writes and growth cap',async()=>{
  const converted=convertScript('const b=$response.body;b[0]=7;$done($response);',{binary:true});
  const code=Buffer.from(internals.parseCsv(converted.files[0].content.split('\n').find(x=>/^1, 100,/.test(x)))[3],'base64');
  assert(code.length<4000);
  assert.deepEqual([...(await runConverted(converted,[255,128,0])).bytes],[7,128,0]);
  const oversized=convertScript('$done({body:"x".repeat(65538)});');
  assert.equal((await runConverted(oversized,'a')).text,'a');
});

test("headers-only script does not decode input body", async () => {
  const actual = await runConverted(convertScript('$done({});', { jsLift: false }), "original");
  assert.equal(actual.decodes, 0); assert.equal(actual.text, "original");
});

test('unreturned async IIFE completes before the adapter returns', async () => {
  const source='(async()=>{await Promise.resolve();await Promise.resolve();return "changed"})().then(body=>$done({body}));';
  assert.equal((await runConverted(convertScript(source),'original')).text,'changed');
});

test('dispatcher never renames an upstream nested process function', async()=>{
  const src='function process(ctx){return "inner";} $done({body:process({})+$argument});';
  const module='[Script]\na=type=http-response,pattern=^https://example.com/,script-path=https://example.com/a.js,argument=one\nb=type=http-response,pattern=^https://example.com/feed,script-path=https://example.com/b.js,argument=two';
  const result=convertModule(module,{fetchScripts:true,scriptTextByURL:{'https://example.com/a.js':src,'https://example.com/b.js':src}});
  assert.equal((await runConverted(result,'original')).text,'innertwo');
});

test('request lifting rejects unknown operations and preserves header statement order',()=>{
  const module='[Script]\ns=type=http-request,pattern=^https://example.com/,script-path=https://example.com/s.js';
  const convert=src=>convertModule(module,{fetchScripts:true,scriptTextByURL:{'https://example.com/s.js':src}});
  const rejected=convert('$request.headers["x"]="one";$request.method="POST";$done($request);');
  assert(!rejected.diagnostics.some(d=>d.code==='script-request-lift'));
  assert(rejected.diagnostics.some(d=>d.code==='request-mutation-script'));
  const valid=convert('delete $request.headers["x"];$request.headers["x"]="one";$done($request);');
  assert.deepEqual(valid.files[0].content.split('\n').filter(x=>/^0, [23],/.test(x)).map(x=>internals.parseCsv(x)[1]),['2','3']);
});

test('query redirect retains exact upstream match and response headers',async()=>{
  const src='let url=$request.url;let match=url.match(/url=([^&]+)/);if(match){let target=decodeURIComponent(match[1]);$done({response:{status:302,headers:{Location:target,"Cache-Control":"private"}}});return;}$done({});';
  const module='[Script]\ns=type=http-request,pattern=^https://example.com/,script-path=https://example.com/s.js';
  const result=convertModule(module,{fetchScripts:true,scriptTextByURL:{'https://example.com/s.js':src}});
  const output=await runConverted(result,'',{}, {phase:'request',url:'https://example.com/?noturl=https%3A%2F%2Ftarget.example%2F'});
  assert.equal(output.responses[0].headers.Location,'https://target.example/');
  assert.equal(output.responses[0].headers['Cache-Control'],'private');
});

test("shared static runners keep argument isolation and await overlapping HTTP scripts", async () => {
  const src = 'let o=JSON.parse($response.body);$httpClient.get("https://side.example/",()=>{o.steps.push($argument);$done({body:JSON.stringify(o)});});';
  const module = '[Script]\na=type=http-response,pattern=^https://example.com/,requires-body=1,script-path=https://example.com/s.js,argument=first\nb=type=http-response,pattern=^https://example.com/feed,requires-body=1,script-path=https://example.com/s.js,argument=second\n[MITM]\nhostname=example.com';
  const result = convertModule(module, { fetchScripts: true, scriptTextByURL: { 'https://example.com/s.js': src } });
  const compiled = result.files[0].content.split('\n').filter(x => /^1, 100,/.test(x)).map(x => Buffer.from(internals.parseCsv(x)[3], 'base64').toString()).join('\n');
  assert.equal((compiled.match(/function __converter_runner_/g) || []).length, 1);
  assert(!compiled.includes('new Function('));
  const trace = [];
  const actual = await runConverted(result, '{"steps":[]}', { http: { request: async () => { trace.push('start'); await Promise.resolve(); trace.push('end'); return { status: 200, headers: [], body: new Uint8Array() }; } } });
  assert.deepEqual(JSON.parse(actual.text).steps, ['first', 'second']); assert.deepEqual(trace, ['start', 'end', 'start', 'end']);
});

const smallModule = '#!name=Bundle\n[Rule]\nDOMAIN-SUFFIX,ads.example.com,REJECT\n[Rewrite]\n^https://api.example.com/ad reject-dict\n[MITM]\nhostname=api.example.com';
test("optional AMOD bundles routing and MITM; standalone remains default", () => {
  const r = convertAny(smallModule, { outputFormat: 'amod' });
  assert.equal(r.files.length, 1); assert.equal(r.files[0].type, 'amod');
  assert.match(r.files[0].content, /\[Routing\]/); assert.match(r.files[0].content, /\[MITM\]/);
  assert.deepEqual(validateAnywhereOutput(r.files[0]), []);
  assert.equal(convertAny(smallModule).files.length, 2);
});

test("AMOD keeps parameters and stable child names", () => {
  const module = '#!name=Params\n#!arguments= switch:true\n[Script]\ns=type=http-response,pattern=^https://example.com/,script-path=https://example.com/s.js,argument={{{switch}}}\n[MITM]\nhostname=example.com';
  const r = convertAny(module, { outputFormat: 'amod', preserveParameters: true, fetchScripts: true, scriptTextByURL: {'https://example.com/s.js':'$done({body:$argument});'} });
  assert.match(r.files[0].content, /\[Parameter\]/); assert.match(r.files[0].content, /name = Params/);
  assert.deepEqual(validateAnywhereOutput(r.files[0]), []);
});

test("AMOD rejects excess sets, icons and encoded budget, falls back without losing files", () => {
  assert(moduleBudget(Array.from({length:65}, (_, i) => `[Routing]\nname=S${i}\n2,example.com`).join('\n')).errors.length);
  assert(moduleBudget('[Module]\nicon-light='+Buffer.alloc(65537).toString('base64')+'\n[Routing]\n2,example.com').errors.length);
  const r = { files: [{type:'amrs',name:'large.amrs',ruleCount:1,content:'name=large\nhostname=example.com\n1,100,.*, '+Buffer.alloc(700000).toString('base64')}], diagnostics: [] };
  packageAmod(r, {outputFormat:'amod'}); assert.equal(r.files[0].type, 'amrs'); assert.equal(r.diagnostics[0].code, 'amod-budget-fallback');
});

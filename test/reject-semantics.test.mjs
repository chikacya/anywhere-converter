import test from 'node:test';
import assert from 'node:assert/strict';
import {convertAny,internals,validateAnywhereOutput} from '../src/core.mjs';
import {runConverted} from './runtime-harness.mjs';

for(const [action,expected,type] of [['reject-200','','text/plain'],['reject-dict','{}','application/json'],['reject-array','[]','application/json']]){
  test('legacy '+action+' retains exact body and MIME, not Anywhere default text',async()=>{
    const result=convertAny('[Rewrite]\n^https://example.com/ad '+action+'\n[MITM]\nhostname=example.com');
    assert.equal(result.report.skipped,0);assert.deepEqual(validateAnywhereOutput(result.files[0]),[]);
    const actual=await runConverted(result,'',{}, {phase:'request',url:'https://example.com/ad'});
    assert.equal(actual.responses.length,1);const response=actual.responses[0];
    assert.equal(response.status,200);assert.equal(response.body,expected);
    assert(response.headers.some(([k,v])=>k==='content-type'&&v.startsWith(type)));
  });
}

test('legacy connection reject remains visibly degraded without whole-host blocking',()=>{
  const r=convertAny('[Rewrite]\n^https://example.com/ad reject\n[MITM]\nhostname=example.com');
  assert.equal(r.report.status,'sample-required');assert(r.diagnostics.some(d=>d.code==='reject-connection-sample-required'));
  assert(!r.files[0].content.includes('[Routing]'));
});

test('explicit empty reject-data does not become the native default payload',async()=>{
  const r=convertAny('[Rewrite]\n^https://example.com/ad reject-data\n[MITM]\nhostname=example.com');
  const actual=await runConverted(r,'',{}, {phase:'request',url:'https://example.com/ad'});
  assert.equal(actual.responses[0].body.length,0);
  assert(actual.responses[0].headers.some(([k,v])=>k==='content-type'&&v==='application/octet-stream'));
});

test('new reject_img(200) maps to native GIF rather than being skipped',()=>{
  const r=convertAny('[Rewrite]\nrequest if ${url} ~= /^https:\\/\\/example\\.com\\/ad/ then reject_img(200)\n[MITM]\nhostname=example.com');
  assert.equal(r.report.skipped,0,JSON.stringify(r.diagnostics));
  const row=r.files[0].content.split('\n').find(row=>/^0, 0,/.test(row));assert.equal(internals.parseCsv(row)[3],'3');
});

test('upstream malformed v2 bare options and raw URL delimiters are rejected, never guessed',()=>{
  for(const text of ['[Rewrite]\nrequest if ${url} ~= /^https?://example.com/ad/ then reject(404)',
    '[Script]\nresponse if ${url} ~= /example/ then script("https://scripts.example/a.js") with enable=enabled']){
    const r=convertAny(text);assert.equal(r.report.skipped,1);assert.equal(r.files.length,0);assert(r.diagnostics.some(d=>d.code==='loon-v2-invalid'));
  }
});

test('literal jq root assignment creates missing data instead of existing-only replace',()=>{
  assert.deepEqual(internals.jqToBodyJson(1,'.*','.data = []').fields,['add','$.data','[]']);
  assert.equal(internals.jqToBodyJson(1,'.*','.data = .other'),null,'expressions are not JSON literals');
});

test('Beta-style /i rejects retain case-insensitive gates after script merging',async()=>{
  const source='[Rewrite]\nrequest if ${url} ~= /^https?:\\/\\/api-cfg\\.example\\.com\\/v1\\/(adv|reward|operation)/i then reject(200)\nrequest if ${url} ~= /^https?:\\/\\/cdn\\.example\\.com\\/adUnionVideo/i then reject(200)\n[MITM]\nhostname=api-cfg.example.com,cdn.example.com';
  const r=convertAny(source);assert.equal(r.report.skipped,0);
  for(const url of ['https://api-cfg.example.com/v1/ADV','https://api-cfg.example.com/V1/reward','https://cdn.example.com/adunionvideo']){
    const actual=await runConverted(r,'',{}, {phase:'request',url});assert.equal(actual.responses.length,1,url);assert.equal(actual.responses[0].status,200);assert.equal(actual.responses[0].body.length,0);
  }
  const miss=await runConverted(r,'',{}, {phase:'request',url:'https://api-cfg.example.com/v1/books'});assert.equal(miss.responses.length,0);
});

test('flagged native JSON cache header gates merge with a single leading flag',()=>{
  const r=convertAny('[Rewrite]\nresponse if ${url} ~= /^https:\\/\\/example\\.com\\/a/i then response.json.delete("ad")\nresponse if ${url} ~= /^https:\\/\\/example\\.com\\/b/i then response.json.delete("ad")\n[MITM]\nhostname=example.com');
  assert.equal(r.report.skipped,0);assert.deepEqual(validateAnywhereOutput(r.files[0]),[]);
  const headers=r.files[0].content.split('\n').filter(row=>/^0, 2,/.test(row)).map(internals.parseCsv);
  assert.equal(headers.length,2);assert(headers.every(row=>row[2].startsWith('(?i)')));
  assert(headers.every(row=>(row[2].match(/\(\?i\)/g)||[]).length===1));
});

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { convertScript, runUpstream } from '../test/runtime-harness.mjs';
import { convertAny, internals } from '../src/core.mjs';

const app=resolve(process.argv[2] || '../../Anywhere');
const model=await readFile(resolve(app,'Shared/Models/MITMRule.swift'),'utf8');
const enumSource=model.match(/nonisolated enum MITMJSONOperation: Equatable \{[^}]+\}/)?.[0];
assert(enumSource,'Actual native enum not found');
const directory=await mkdtemp(resolve(tmpdir(),'converter-native-'));
try {
  // Generated build input, a verbatim extraction rather than a maintained copy.
  await writeFile(resolve(directory,'Operations.swift'),enumSource);
  const compile=spawnSync('swiftc',[resolve(directory,'Operations.swift'),resolve(app,'Anywhere Network Extension/MITM/MITMJSONPatch.swift'),resolve('test/native-json-probe.swift'),'-o',resolve(directory,'probe')],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const sources=['let o=JSON.parse($response.body);o.newField=true;delete o.ad;$done({body:JSON.stringify(o)});','let o=JSON.parse($response.body);o.ad=true;delete o.ad;o.newField=false;$done({body:JSON.stringify(o)});','let o=JSON.parse($response.body);o.ad=true;delete o.ad;o.ad=true;$done({body:JSON.stringify(o)});'];
  const inputs=['{"ad":1,"data":{}}','{}','{"newField":true,"items":[1,null,{}]}','invalid JSON','{ "large":9007199254740993,"ad":1 }','{ "newField":true }'];
  const entries=[],js=[];
  for(const source of sources) {
    const result=convertScript(source);
    const operations=result.files[0].content.split('\n').filter(x=>/^1, 5,/.test(x)).map(x=>internals.parseCsv(x).slice(3));
    assert(operations.length);
    for(const input of inputs){ entries.push({input,operations});js.push(await runUpstream(source,input)); }
  }
  const qx=convertAny('hostname=example.com\n^https://example.com/ url jsonjq-response-body \'.data |= map(select(.kind | IN("广告", "banner") | not))\'');
  const qxOperations=qx.files[0].content.split('\n').filter(x=>/^1, 5,/.test(x)).map(x=>internals.parseCsv(x).slice(3));
  assert.equal(qxOperations[0][0],'remove-where-field-in');
  for(const object of [{data:[{kind:'广告'},{kind:'banner'},{kind:'normal'},{other:1}]},{data:[]},{data:[{kind:1},{kind:'广告'}]}]){
    entries.push({input:JSON.stringify(object),operations:qxOperations});
    js.push(JSON.stringify({...object,data:object.data.filter(x=>!['广告','banner'].includes(x.kind))}));
  }
  const execute=spawnSync(resolve(directory,'probe'),[],{input:JSON.stringify(entries),encoding:'utf8'});
  assert.equal(execute.status,0,execute.stderr); const native=JSON.parse(execute.stdout);
  let structural=0,invalid=0,largeInteger=0,formatting=0;
  native.forEach((output,i)=>{
    if(entries[i].input==='invalid JSON'){ assert.equal(output,js[i]);invalid++;return; }
    if(entries[i].input.includes('9007199254740993')){ assert(output.includes('9007199254740993')); assert(js[i].includes('9007199254740992'));largeInteger++;return; }
    assert.deepEqual(JSON.parse(output),JSON.parse(js[i]));structural++;
    if(output!==js[i])formatting++;
  });
  console.log(JSON.stringify({cases:entries.length,structural,invalid,largeIntegerPrecisionDifference:largeInteger,serializationDifference:formatting,note:'Structural JSON equivalence, not byte-identical JS stringify. Large integers stay exact natively.'},null,2));
} finally { await rm(directory,{recursive:true,force:true}); }

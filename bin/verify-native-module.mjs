import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { moduleBudget } from '../src/amod.mjs';

// Compile the actual app parsers and Codable models without editing the app.
// Only unrelated logging and store constants are stubbed; parsing/encoding is native.
const app=resolve(process.argv[2] || '../../Anywhere');
const directory=await mkdtemp(resolve(tmpdir(),'converter-module-'));
try {
  let mitm=await readFile(resolve(app,'Shared/Models/MITMRule.swift'),'utf8');
  mitm=mitm.replace(/^nonisolated private let logger = .*\n/m,'');
  const snapshotStart=mitm.indexOf('nonisolated struct MITMSnapshot');
  assert(snapshotStart>0,'Actual native MITMSnapshot boundary not found');
  mitm=mitm.slice(0,snapshotStart);
  let routing=await readFile(resolve(app,'Shared/Models/RoutingRule.swift'),'utf8');
  routing=routing.slice(0,routing.indexOf('/// On-disk layout'));
  await writeFile(resolve(directory,'MITMRule.swift'),mitm);
  await writeFile(resolve(directory,'RoutingRule.swift'),routing);
  await writeFile(resolve(directory,'Support.swift'),`import Foundation
enum CustomRoutingRuleSet { static let maxRuleCount = 100000 }
enum SyncStore { static let maxSyncedPayloadBytes = 900000 }
`);
  await writeFile(resolve(directory,'main.swift'),`import Foundation
let input = FileHandle.standardInput.readDataToEndOfFile()
let cases = try JSONDecoder().decode([String].self, from: input)
let output = try cases.map { text -> [String: Int] in
    let parsed = ModuleParser.parse(text)
    var module = parsed.makeModule(name: parsed.name)
    module.updatedAt = Date(timeIntervalSinceReferenceDate: 999999999)
    return ["encodedBytes": module.encodedByteCount()!, "sets": module.ruleSetCount,
            "rules": module.routingRuleSets.reduce(0) { $0 + $1.rules.count } + module.mitmRuleSets.reduce(0) { $0 + $1.rules.count },
            "parameters": module.mitmRuleSets.reduce(0) { $0 + $1.parameters.count }]
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: output))
`);
  const files=['Shared/Models/Module.swift','Shared/Protocols/SoftDeletable.swift','Shared/DataStore/FailableDecodable.swift',
    'Shared/Utilities/Data+init.swift','Anywhere/Views/Pages/MITM/MITMRuleSetParser.swift',
    'Anywhere/Views/Pages/Routing/RoutingRuleParser.swift','Anywhere/Views/Pages/Modules/ModuleParser.swift'];
  const compile=spawnSync('swiftc',[resolve(directory,'Support.swift'),resolve(directory,'MITMRule.swift'),resolve(directory,'RoutingRule.swift'),
    ...files.map(file=>resolve(app,file)),resolve(directory,'main.swift'),'-o',resolve(directory,'probe')],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const quote=value=>'"'+value.replaceAll('"','""')+'"';
  const script=Buffer.from('function process(ctx){return ctx;}').toString('base64');
  const rows=[
    '0,0,^https://example.com/,0,https://target.example/$1', '0,0,^https://example.com/,1,https://target.example/$1',
    '0,0,^https://example.com/,2," 文本/内容 "','0,0,^https://example.com/,3', '0,0,^https://example.com/,4,YQ==',
    '0,1,^https://example.com/,X-Test," 值/值 "','1,2,^https://example.com/,X-Test','0,3,^https://example.com/,X-Test,x',
    '1,4,^https://example.com/,"a,b","c/d"',
    ...['add','replace','delete','replace-recursive','delete-recursive','remove-where-key-exists','remove-where-field-in'].map(action=>
      ['1','5','^https://example.com/',action,...({add:['a','true'],replace:['a','false'],delete:['a'],'replace-recursive':['a','{}'],'delete-recursive':['a'],'remove-where-key-exists':['a','ad'],'remove-where-field-in':['a','kind','["ad","广告"]']}[action])].map(quote).join(',')),
    '1,100,^https://example.com/,'+script,'1,101,^https://example.com/,'+script,
  ];
  const cases=[
    ...rows.map(row=>'[Module]\nname=中文/模块\ndescription=介绍/说明\n[MITM]\nname=中文/规则\nhostname=example.com,foo.example\n'+row),
    '[Module]\nname=Params\nicon-light='+Buffer.from([255,255,255]).toString('base64')+'\n[MITM]\nname=Params\n[Parameter]\n0,0,INPUT,标签,来自上游," 空格/值 "\n1,0,PICK,,,缺省,"[A,B]"\n1,0,EMPTY,,,,"[A,B]"\n[Rule]\n'+rows[0],
    '[Module]\nname=Routes\n[Routing]\nname=All\nrouting=2\n0,1.2.3.4\n1,::1\n2,example.com\n3,keyword',
    ...[12000,30000].map(count=>'[Module]\nname=Large\n[Routing]\nname=Ads\n'+Array.from({length:count},(_,i)=>'2,ad'+i+'.example').join('\n')),
  ];
  // Also accept locally generated converted .amod artifacts as verification input.
  for(const file of process.argv.slice(3)) cases.push(await readFile(resolve(file),'utf8'));
  const execute=spawnSync(resolve(directory,'probe'),[],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(execute.status,0,execute.stderr);
  const native=JSON.parse(execute.stdout);
  const comparisons=native.map((actual,i)=>{
    const estimate=moduleBudget(cases[i]);
    assert.equal(actual.sets,estimate.sets);
    assert(actual.rules>0,'Native parser discarded all rules in case '+i);
    const delta=estimate.encodedBytes-actual.encodedBytes;
    assert(delta>=0 && delta<=16,JSON.stringify({i,actual,estimate,delta}));
    return {case:i,nativeBytes:actual.encodedBytes,estimatedBytes:estimate.encodedBytes,delta,rules:actual.rules,parameters:actual.parameters};
  });
  console.log(JSON.stringify({source:app,cases:cases.length,comparisons,note:'Actual Swift parsing/JSONEncoder. Estimate adds a separate 4096-byte reserve; no device traffic verification.'},null,2));
} finally { await rm(directory,{recursive:true,force:true}); }

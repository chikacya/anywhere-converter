import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleBudget } from '../src/amod.mjs';
import { convertAny, convertAnyAsync, validateAnywhereOutput } from '../src/core.mjs';

test('native model budget admits thousands of routing rules instead of per-rule padding', () => {
  const content = '[Module]\nname=Large\n[Routing]\nname=Ads\nrouting=2\n' + Array.from({length:12000}, (_,i)=>'2,ad'+i+'.example').join('\n');
  const budget = moduleBudget(content);
  assert.deepEqual(budget.errors, []);
  assert(budget.encodedUpperBound < 600000);
  assert(moduleBudget(content + '\n' + '2,verylong.example\n'.repeat(20000)).errors.length);
});

test('AMOD budget accounts for repeated base64 scripts, unicode and JSON escaping', () => {
  const script = Buffer.from('function process(){return "广告/\\\"";}').toString('base64');
  const content = '[Module]\nname=中文\ndescription=介绍\n[MITM]\nname=中文\nhostname=example.com\n[Parameter]\n1,0,NAME,标签,来自上游,"默认值","[默认值,备选]"\n[Rule]\n1,100,^https://example.com/, '+script;
  const budget = moduleBudget(content);
  assert.deepEqual(budget.errors, []);
  assert(budget.encodedBytes > new TextEncoder().encode(content).length);
  assert.equal(moduleBudget(content+'\n1,100,^https://example.com/, '+script).encodedBytes-budget.encodedBytes,
    Buffer.byteLength(JSON.stringify({phase:'httpResponse',urlPattern:'^https://example.com/',operation:{kind:'script',script}}).replaceAll('/', '\\/'))+1);
});

test('automatic async packaging keeps parameter/hostname/child names identical to standalone', async () => {
  const source='#!name=参数插件\n#!arguments=enable:true\n[Script]\ns=type=http-response,pattern=^https://example.com/,script-path=https://scripts.example/a.js,argument={{{enable}}}\n[Rule]\nDOMAIN,ad.example,REJECT\n[MITM]\nhostname=example.com';
  const options={preserveParameters:true,fetchText:async()=>'$done({body:$response.body+$argument});'};
  const result=await convertAnyAsync(source,options);
  const standalone=await convertAnyAsync(source,{...options,outputFormat:'standalone'});
  assert.equal(result.files[0].type,'amod');
  for(const file of standalone.files) assert(result.files[0].content.includes(file.content.trimEnd()));
  assert.deepEqual(validateAnywhereOutput(result.files[0]),[]);
  assert.equal(convertAny('DOMAIN,example.com',{outputFormat:'auto'}).files[0].type,'arrs');
});

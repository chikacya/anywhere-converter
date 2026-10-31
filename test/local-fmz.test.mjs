import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {convertAny,validateAnywhereOutput} from '../src/core.mjs';
import {runConverted} from './runtime-harness.mjs';

// Optional locked upstream inputs stay local; no remote download during tests.
const directory=new URL('../local-verification/20261031/fmz-lpx/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('beta-resources.json',directory),'utf8').catch(()=>'{}'));
const scripts={};
for(const [url,entry] of Object.entries(manifest)){
  const source=await readFile(new URL(entry.file,directory),'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
  scripts[url]=source;
}
for(const id of ['QiMaoNovel','QiDianReading','FanQieNovel','XiaoYuZhou','Xiaohongshu','Hupu']){
  const source=await readFile(new URL(id+'-beta.lpx',directory),'utf8').catch(()=>null);
  test('fmz Beta snapshot: '+id,{skip:!source||id==='Xiaohongshu'&&!Object.keys(scripts).length},async()=>{
    const result=convertAny(source,{preserveParameters:true,fetchScripts:true,scriptTextByURL:scripts});
    assert(result.files.length);
    for(const file of result.files)assert.deepEqual(validateAnywhereOutput(file),[]);
    assert.equal(result.report.skipped,id==='Xiaohongshu'?1:0,JSON.stringify(result.diagnostics));
    if(id==='QiMaoNovel'){
      assert.equal(result.report.converted,14);assert.equal(result.report.skipped,0);
      const content=result.files[0].content;
      assert(content.includes('routing = 2'));assert.equal(content.split('[Routing]')[1].split('\n').filter(row=>/^2,/.test(row)).length,7);
      for(const url of ['https://api-cfg.wtzw.com/v1/adv','http://api-cfg.wtzw.com/V1/ADV','https://p1-lm.adukwai.com/bs2/adunionvideo']){
        const actual=await runConverted(result,'',{}, {phase:'request',url});assert.equal(actual.responses.length,1,url);assert.equal(actual.responses[0].status,200);assert.equal(actual.responses[0].body.length,0);
      }
      assert.equal((await runConverted(result,'',{}, {phase:'request',url:'https://api-cfg.wtzw.com/v1/books'})).responses.length,0);
    }
    if(id==='Xiaohongshu'){
      const actual=await runConverted(result,'{"data":{"items":[1],"keep":true}}',{}, {url:'https://edith.xiaohongshu.com/api/sns/v1/search/hot_list'});
      assert.deepEqual(JSON.parse(actual.text),{data:{items:[],keep:true}},actual.errors.join('\n'));
    }
  });
}

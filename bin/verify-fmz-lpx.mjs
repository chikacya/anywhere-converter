import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {convertAnyAsync,validateAnywhereOutput} from '../src/core.mjs';
import {runConverted} from '../test/runtime-harness.mjs';

// No third-party fixtures are committed. --download explicitly refreshes local
// inputs; the default rerun is offline and verifies locked resource hashes.
const directory=resolve(process.argv[2]||'local-verification/20261031/fmz-lpx');
const download=process.argv.includes('--download');
await mkdir(directory,{recursive:true});
const manifestPath=resolve(directory,'beta-resources.json');
const resources=JSON.parse(await readFile(manifestPath,'utf8').catch(()=>'{}'));
const hash=text=>createHash('sha256').update(text).digest('hex');
const names=['QiMaoNovel','QiDianReading','FanQieNovel','XiaoYuZhou','Xiaohongshu','Hupu'];
const summary=[];
for(const id of names){
  const url=`https://raw.githubusercontent.com/ifflagged/Romeo/main/Modules/Loon/fmz200/Beta/${id}.lpx`;
  const sourcePath=resolve(directory,id+'-beta.lpx');
  if(download){const r=await fetch(url);assert(r.ok,url+' HTTP '+r.status);await writeFile(sourcePath,await r.text());}
  const source=await readFile(sourcePath,'utf8');
  const result=await convertAnyAsync(source,{sourceUrl:url,preserveParameters:true,fetchScripts:true,
    maxScriptBytes:1048576,maxTotalScriptBytes:5242880,maxScriptFetches:45,
    fetchText:async url=>{
      let entry=resources[url];
      if(download){
        const r=await fetch(url);assert(r.ok,url+' HTTP '+r.status);const text=await r.text();
        entry={file:'resource-'+hash(url).slice(0,16)+'.js',sha256:hash(text)};
        await writeFile(resolve(directory,entry.file),text);resources[url]=entry;
      }
      assert(entry,'Missing locked resource: '+url);
      const text=await readFile(resolve(directory,entry.file),'utf8');assert.equal(hash(text),entry.sha256);return text;
    },
  });
  assert(result.files.length,id);const validation=result.files.flatMap(validateAnywhereOutput);assert.deepEqual(validation,[],id);
  for(const file of result.files)await writeFile(resolve(directory,id+'-beta-checked.'+file.type),file.content);
  const record={id,url,sourceSha256:hash(source),report:result.report,hostnames:result.hostnames,diagnostics:result.diagnostics};
  if(id==='QiMaoNovel'){
    assert.equal(result.report.skipped,0);assert.equal(result.report.converted,14);
    const content=result.files[0].content;assert(content.includes('routing = 2'));assert.equal(content.split('[Routing]')[1].split('\n').filter(l=>/^2,/.test(l)).length,7);
    const cases=[['open.e.kuaishou.cn','/rest/e/v3/open/univ'],['api-access.pangolin-sdk-toutiao-b.com','/api/ad/union/sdk/get_ads'],['api-access.pangolin-sdk-toutiao.com','/api/ad'],['api-access.pangolin-sdk-toutiao1.com','/api/ad'],['dsp-x.jd.com','/adx/sdk'],['api-cfg.wtzw.com','/v1/adv'],['api-cfg.wtzw.com','/v1/reward'],['api-cfg.wtzw.com','/v1/operation'],['p1-lm.adukwai.com','/bs2/adUnionVideo'],['lf-cdn-tos.bytescm.com','/obj/static/ad']];
    let count=0;for(const [host,path] of cases)for(const scheme of ['http','https'])for(const variant of [path,path.toLowerCase(),path.toUpperCase()]){
      const url=scheme+'://'+host+variant,actual=await runConverted(result,'',{}, {phase:'request',url});
      assert.equal(actual.responses.length,1,url);assert.equal(actual.responses[0].status,200,url);assert.equal(actual.responses[0].body.length,0,url);count++;
    }
    assert.equal((await runConverted(result,'',{}, {phase:'request',url:'https://api-cfg.wtzw.com/v1/books'})).responses.length,0);
    record.runtimeCases=count;
  }
  if(id==='Xiaohongshu'){
    const output=await runConverted(result,'{"data":{"items":[1],"keep":true}}',{}, {url:'https://edith.xiaohongshu.com/api/sns/v1/search/hot_list'});
    assert.deepEqual(JSON.parse(output.text),{data:{items:[],keep:true}},output.errors.join('\n'));record.runtimeCases=1;
  }
  await writeFile(resolve(directory,id+'-beta-checked-result.json'),JSON.stringify({record,result},null,2));
  summary.push(record);console.log(JSON.stringify({id,converted:result.report.converted,skipped:result.report.skipped,runtimeCases:record.runtimeCases,issues:[...new Set(result.diagnostics.map(x=>x.code))]}));
}
await writeFile(manifestPath,JSON.stringify(resources,null,2));
await writeFile(resolve(directory,'beta-summary.json'),JSON.stringify(summary,null,2));

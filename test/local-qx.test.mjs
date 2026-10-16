import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { convertAny, convertAnyAsync, validateAnywhereOutput } from '../src/core.mjs';
import { runConverted, runUpstream } from './runtime-harness.mjs';

const directory=new URL('../local-verification/20261016/',import.meta.url);
for(const file of ['tx.sgmodule','xiaoxiongyouhao.js','moyu-MoJiWeatherAds.conf','moyu-XiaoYuZhouAds.conf']){
  const source=await readFile(new URL(file,directory),'utf8').catch(()=>null);
  test('locked remote sample: '+file,{skip:!source},async()=>{
    const options=file.endsWith('.js')?{sourceUrl:'https://raw.githubusercontent.com/89996462/Quantumult-X/main/ycdz/xiaoxiongyouhao.js'}:{};
    const result=await convertAnyAsync(source,{...options,fetchText:async()=>{throw Error('offline sample must not fetch');}});
    assert(result.files.length);assert.equal(result.report.skipped,0,JSON.stringify(result.diagnostics));
    for(const output of result.files)assert.deepEqual(validateAnywhereOutput(output),[]);
    if(file==='tx.sgmodule'){
      const expected=[...new Set(source.match(/hostname\s*=\s*(.*)/i)[1].replace('%APPEND%','').split(',').map(x=>x.trim().replace(/^\*\./,'')))];
      assert.deepEqual(result.hostnames,expected);assert.equal(result.hostnames.length,10);
      assert.match(result.files[0].content,/https:\/\/txscript.pages.dev\/tx\/\$1\/\$2/);
    }
    if(file==='xiaoxiongyouhao.js'){
      assert(result.hostnames.includes('www.xiaoxiongyouhao.com'));
      for(const input of ['{"vip_state":0,"membership_days":7,"vip_valid_till_date":"2026-01-01","other":1}','{}','not JSON']){
        assert.equal((await runConverted(result,input,{}, {url:'https://www.xiaoxiongyouhao.com/api/vip/index.php'})).text,await runUpstream(source,input));
      }
    }
    if(file.startsWith('moyu-'))assert.equal(result.report.scriptMetrics.totalScriptBytes,0);
    if(file==='moyu-MoJiWeatherAds.conf')assert(result.diagnostics.some(d=>d.code==='hostname-wildcard-expanded'));
    const module=convertAny(source,{...options,outputFormat:'amod'});
    assert.equal(module.files[0].type,'amod');assert.match(module.files[0].content,/hostname = /);
  });
}

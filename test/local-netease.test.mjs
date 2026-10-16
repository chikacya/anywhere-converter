import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDecipheriv } from 'node:crypto';
import { convertAny } from '../src/core.mjs';
import { runConverted } from './runtime-harness.mjs';

const root=new URL('../../../anywhere-mitm-maintainer/',import.meta.url);
const upstream=await readFile(new URL('sources/scripts/neteasecloudmusic_wyyad.js',root),'utf8').catch(()=>null);
const module=await readFile(new URL('sources/modules/NetEaseCloudMusic.sgmodule',root),'utf8').catch(()=>null);
test('locked real NetEase source: parameters change encrypted bottom tabs', {skip: !upstream || !module}, async()=>{
  const texts={};for(const m of module.matchAll(/https?:\/\/[^\s,]+wyyad\.js/g))texts[m[0]]=upstream;
  const converted=convertAny(module,{fetchScripts:true,scriptTextByURL:texts,preserveParameters:true});
  assert.equal(converted.files[0].type,'amod');
  assert.match(converted.files[0].content,/\[Parameter\]/);
  const input=JSON.stringify({data:{commonResourceList:[{title:'首页'},{title:'漫游'},{title:'发现'},{title:'我的'}]}});
  const decrypt=bytes=>{const cipher=createDecipheriv('aes-128-ecb',Buffer.from('e82ckenh8dichen8'),null);return JSON.parse(Buffer.concat([cipher.update(bytes),cipher.final()]).toString());};
  for(const MY of ['0','1']){
    const output=await runConverted(converted,input,{params:{get:k=>k==='MY'?MY:undefined}}, {url:'https://interface.music.163.com/eapi/link/home/framework/tab'});
    assert.notEqual(output.text,input,output.errors.join('\n'));
    const titles=decrypt(output.bytes).data.commonResourceList.map(x=>x.title);
    assert.equal(titles.includes('漫游'),MY==='0');
  }
  const invalid=[255,128,0,1];
  const passthrough=await runConverted(converted,invalid,{}, {url:'https://interface.music.163.com/eapi/link/home/framework/tab'});
  assert.deepEqual([...passthrough.bytes],invalid);
});

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { convertAny, internals, validateAnywhereOutput } from '../src/core.mjs';

// Optional local evidence; no snapshots are copied into this repository and no
// remote scripts are fetched. URL mappings come from locked upstream manifests.
const root=resolve(process.argv[2] || '../../anywhere-mitm-maintainer');
const ref=process.argv[3] || '64f5797';
const oldSource=spawnSync('git',['show',ref+':src/core.mjs'],{encoding:'utf8'});
if(oldSource.status!==0)throw Error(oldSource.stderr);
const baseline=await import('data:text/javascript;base64,'+Buffer.from(oldSource.stdout).toString('base64'));
const ids=['spotify','xiaohongshu','bilibili','youtube-enhance','pixiv','umetrip','netease-cloudmusic'];
const report=[];
function metrics(files){
  const sizes=[];let rules=0;
  for(const file of files){rules+=file.ruleCount || 0;for(const row of file.content.split('\n'))if(/^[01],\s*10[01],/.test(row)){sizes.push(Buffer.from(internals.parseCsv(row)[3],'base64').length);}}
  return {rules,scripts:sizes.length,totalScriptBytes:sizes.reduce((a,b)=>a+b,0),largestScriptBytes:Math.max(0,...sizes)};
}
for(const id of ids){
  const manifest=JSON.parse(await readFile(resolve(root,'catalog/plugins',id+'.json'),'utf8'));
  const modulePath=manifest.sourceFiles.find(x=>/\.(?:module|sgmodule|lpx)$/.test(x)) || manifest.sourceFiles.find(x=>/\.conf$/.test(x));
  const source=await readFile(resolve(root,modulePath),'utf8');
  const texts={}, locked=[];
  for(const upstream of manifest.upstreams || [])for(const entry of upstream.files || []){
    if(!entry.local || !entry.url)continue;
    const text=await readFile(resolve(root,entry.local),'utf8');
    if(entry.sha256 && createHash('sha256').update(text).digest('hex')!==entry.sha256)throw Error('Snapshot hash mismatch: '+entry.local);
    for(const url of [entry.url,entry.previousUrl,entry.recoveredUrl].filter(Boolean))texts[url]=text;
    locked.push({path:entry.local,sha256:createHash('sha256').update(text).digest('hex')});
  }
  const unresolved=[];
  for(const match of source.matchAll(/https?:\/\/[^\s,]+\.js\b/g)){
    const url=match[0];if(texts[url])continue;
    const name=url.split('/').pop();const candidates=Object.entries(texts).filter(([key])=>key.split('/').pop()===name);
    if(candidates.length && candidates.every(([,text])=>text===candidates[0][1]))texts[url]=candidates[0][1];else unresolved.push(url);
  }
  const options={fetchScripts:true,scriptTextByURL:texts,preserveParameters:true};
  const before=baseline.convertAny(source,options),after=convertAny(source,options);
  const stable=[];for(const artifact of manifest.artifacts.stable || [])stable.push({content:await readFile(resolve(root,artifact.path),'utf8'),ruleCount:0});
  const errors=after.files.flatMap(validateAnywhereOutput);
  if(errors.length)throw Error(JSON.stringify({id,errors}));
  report.push({id,modulePath,sourceSha256:createHash('sha256').update(source).digest('hex'),before:metrics(before.files),after:metrics(after.files),handConverted:metrics(stable),skipped:after.report.skipped,unresolved,diagnostics:[...new Set(after.diagnostics.map(x=>x.code))],locked});
}
console.log(JSON.stringify({baseline:ref,offline:true,deviceVerified:false,cases:report},null,2));

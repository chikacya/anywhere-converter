import { readFile, writeFile, mkdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { convertAny, internals, validateAnywhereOutput } from '../src/core.mjs';
import { parseScript } from '../src/js-lift.mjs';

// Optional local evidence; no snapshots are copied into this repository and no
// remote scripts are fetched. URL mappings come from locked upstream manifests.
const root=resolve(process.argv[2] || '../../anywhere-mitm-maintainer');
const ref=process.argv[3] || 'fb79f37';
const temporary=await mkdtemp(resolve(tmpdir(),'converter-baseline-'));
let baseline;
try {
  const names=spawnSync('git',['ls-tree','-r','--name-only',ref,'src'],{encoding:'utf8'});
  if(names.status!==0)throw Error(names.stderr);
  await mkdir(resolve(temporary,'src'));
  await symlink(resolve('node_modules'),resolve(temporary,'node_modules'),'dir');
  for(const path of names.stdout.trim().split('\n').filter(x=>/^src\/[^/]+\.mjs$/.test(x))){
    const file=spawnSync('git',['show',ref+':'+path],{encoding:'utf8',maxBuffer:8*1024*1024});
    if(file.status!==0)throw Error(file.stderr);
    await writeFile(resolve(temporary,path),file.stdout);
  }
  baseline=await import(pathToFileURL(resolve(temporary,'src/core.mjs')));
} finally { await rm(temporary,{recursive:true,force:true}); }
const ids=(process.argv[4] || 'spotify,xiaohongshu,bilibili,youtube-enhance,pixiv,umetrip,netease-cloudmusic,youtube-enhance-full,spotify-dualsubs,weibo,coolapk,smzdm').split(',');
const report=[];
function metrics(files){
  const sizes=[];let rules=0;
  for(const file of files){rules+=file.ruleCount || 0;for(const row of file.content.split('\n'))if(/^[01],\s*10[01],/.test(row)){sizes.push(Buffer.from(internals.parseCsv(row)[3],'base64').length);}}
  return {rules,scripts:sizes.length,totalScriptBytes:sizes.reduce((a,b)=>a+b,0),largestScriptBytes:Math.max(0,...sizes)};
}
for(const id of ids){
  const manifest=JSON.parse(await readFile(resolve(root,'catalog/plugins',id+'.json'),'utf8'));
  const availableModules=[...new Set([...(manifest.sourceFiles||[]),...(manifest.upstreams||[]).flatMap(u=>(u.files||[]).map(f=>f.local).filter(Boolean))])].filter(x=>/\.(?:module|sgmodule|lpx|plugin|conf)$/.test(x));
  const modulePath=availableModules.find(x=>!x.endsWith('.conf')) || availableModules[0];
  if(!modulePath){ report.push({id,skippedReason:'No upstream rewrite module; manual Recipe components are not a standalone module'});continue; }
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
  const stable=[];let stableScriptSyntaxCount=0;
  for(const artifact of manifest.artifacts.stable || []){
    const content=await readFile(resolve(root,artifact.path),'utf8');
    if(artifact.sha256 && createHash('sha256').update(content).digest('hex')!==artifact.sha256)throw Error('Stable hash mismatch: '+artifact.path);
    for(const row of content.split('\n'))if(/^[01],\s*10[01],/.test(row)){
      if(!parseScript(Buffer.from(internals.parseCsv(row)[3],'base64').toString()))throw Error('Stable JS syntax: '+artifact.path);
      stableScriptSyntaxCount++;
    }
    stable.push({content,ruleCount:0});
  }
  const errors=after.files.flatMap(validateAnywhereOutput);
  if(errors.length)throw Error(JSON.stringify({id,errors}));
  const outputFiles=after.files.map(file=>({name:file.name,type:file.type,ruleCount:file.ruleCount,...(file.moduleBudget?{moduleBudget:file.moduleBudget}:{})}));
  report.push({id,modulePath,availableModules,note:'Only the selected source module is converted; custom multi-source Recipe behavior is not inferred.',sourceSha256:createHash('sha256').update(source).digest('hex'),before:metrics(before.files),after:metrics(after.files),outputFiles,handConverted:metrics(stable),stableScriptSyntaxCount,skipped:after.report.skipped,unresolved,diagnostics:[...new Set(after.diagnostics.map(x=>x.code))],locked});
}
console.log(JSON.stringify({baseline:ref,offline:true,deviceVerified:false,cases:report},null,2));

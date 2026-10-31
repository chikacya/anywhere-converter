import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]||'../../Anywhere');
const directory=await mkdtemp(resolve(tmpdir(),'converter-reject-'));
try{
  const policy=await readFile(resolve(root,'Anywhere Network Extension/MITM/MITMRewritePolicy.swift'),'utf8');
  const actualEnum=policy.match(/nonisolated enum ResolvedRewriteAction \{[\s\S]*?\n\}/)?.[0];
  assert(actualEnum,'Native rewrite enum not found');
  const engine=await readFile(resolve(root,'Anywhere Network Extension/MITM/MITMScriptEngine.swift'),'utf8');
  const actualResponse=engine.match(/    struct SynthesizedResponse: Sendable \{[\s\S]*?\n    \}/)?.[0];
  assert(actualResponse,'Native response type not found');
  await writeFile(resolve(directory,'Support.swift'),'import Foundation\nstruct ReplacementURL {}\nenum MITMScriptEngine {\n'+actualResponse+'\n}\n'+actualEnum);
  await writeFile(resolve(directory,'main.swift'),`import Foundation
let actions: [ResolvedRewriteAction] = [.reject200Text(content: ""), .reject200Text(content: "{}"), .reject200Data(base64: ""), .reject200Gif]
let output = actions.map { action -> [String: Any] in
    let response = MITMRespondBuilder.response(for: action)!
    return ["status": response.status, "headers": response.headers.map { [$0.name, $0.value] },
            "bodyBase64": response.body.base64EncodedString(), "bytes": response.body.count]
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: output))
`);
  const compile=spawnSync('swiftc',[resolve(directory,'Support.swift'),resolve(root,'Anywhere Network Extension/MITM/MITMRespondBuilder.swift'),resolve(directory,'main.swift'),'-o',resolve(directory,'probe')],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const result=spawnSync(resolve(directory,'probe'),[],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const actual=JSON.parse(result.stdout);
  assert.equal(Buffer.from(actual[0].bodyBase64,'base64').toString(),'Success from Anywhere');
  assert.equal(Buffer.from(actual[1].bodyBase64,'base64').toString(),'{}');
  assert.match(actual[1].headers[0][1],/^text\/plain/);
  assert.equal(Buffer.from(actual[2].bodyBase64,'base64').toString(),'Anywhere');
  assert.equal(actual[3].headers[0][1],'image/gif');
  assert.equal(Buffer.from(actual[3].bodyBase64,'base64').subarray(0,6).toString(),'GIF89a');
  console.log(JSON.stringify({source:root,actual,note:'Actual native response builder. Empty native text/data args are nonempty defaults; explicit empty and JSON MIME need Anywhere.respond.'},null,2));
}finally{await rm(directory,{recursive:true,force:true});}

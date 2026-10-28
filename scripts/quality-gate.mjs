import {existsSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import process from 'node:process';

const root=resolve(import.meta.dirname,'..');
const localNode=join(root,'.tools','node','bin',process.platform==='win32'?'node.exe':'node');
const localGo=join(root,'.tools','go','bin',process.platform==='win32'?'go.exe':'go');
const node=existsSync(localNode)?localNode:process.execPath;
const go=existsSync(localGo)?localGo:'go';
const goEnvironment=existsSync(localGo)?{GOCACHE:join(root,'.tools','go-cache')}:{ };

const steps=[
  ['Unstaged whitespace check','git',['diff','--check'],root,{}],
  ['Staged whitespace check','git',['diff','--cached','--check'],root,{}],
  ['Character ownership guard',node,[join(root,'scripts','verify-character-assets.mjs')],root,{}],
  ['Release-tool tests',node,['--test',join(root,'scripts','release-tools.test.mjs')],root,{}],
  ['Jira runtime tests',node,['--test',join(root,'scripts','jira-activity.test.mjs')],root,{}],
  ['Go tests',go,['test','./...'],join(root,'backend'),goEnvironment],
  ['Angular type check',node,[join(root,'frontend','node_modules','typescript','bin','tsc'),'-p','tsconfig.app.json','--noEmit'],join(root,'frontend'),{}],
  ['Game-engine tests',node,[join(root,'frontend','scripts','run-engine-tests.mjs')],join(root,'frontend'),{}],
  ['Angular production build',node,[join(root,'frontend','node_modules','@angular','cli','bin','ng.js'),'build','--progress=false'],join(root,'frontend'),{CI:'1'}]
];

for(const [label,command,args,cwd,environment] of steps){
  console.log(`\n==> ${label}`);
  const result=spawnSync(command,args,{cwd,stdio:'inherit',env:{...process.env,...environment}});
  if(result.status!==0){
    console.error(`${label} failed (${basename(command)} exit ${result.status??'unknown'}).`);
    process.exit(result.status??1);
  }
}
console.log('\nQuality gate PASS.');

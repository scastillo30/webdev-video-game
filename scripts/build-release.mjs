import {createHash} from 'node:crypto';
import {chmodSync,cpSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,copyFileSync} from 'node:fs';
import {basename,dirname,join,relative,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import process from 'node:process';

const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
const allowDirty=args.includes('--allow-dirty');
const targetIndex=args.indexOf('--target');
const hostOS=process.platform==='win32'?'windows':process.platform;
const hostArch=process.arch==='arm64'?'arm64':'amd64';
const target=(targetIndex>=0?args[targetIndex+1]:`${hostOS}-${hostArch}`).toLowerCase();
const match=/^(windows|linux|darwin)-(amd64|arm64)$/.exec(target);
if(!match){console.error('Target must be windows-amd64, windows-arm64, linux-amd64, linux-arm64, darwin-amd64, or darwin-arm64.');process.exit(2)}
const [,goos,goarch]=match;
const packageMetadata=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const applicationVersion=packageMetadata.version??'0.0.0';

const run=(command,commandArgs,options={})=>{
  const result=spawnSync(command,commandArgs,{cwd:root,stdio:'inherit',...options,env:{...process.env,...options.env}});
  if(result.status!==0)throw new Error(`${basename(command)} failed with exit code ${result.status??'unknown'}`);
};
const capture=(command,commandArgs)=>{
  const result=spawnSync(command,commandArgs,{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr.trim()||`${command} failed`);
  return result.stdout.trim();
};
const localNode=join(root,'.tools','node','bin',process.platform==='win32'?'node.exe':'node');
const localGo=join(root,'.tools','go','bin',process.platform==='win32'?'go.exe':'go');
const node=existsSync(localNode)?localNode:process.execPath;
const go=existsSync(localGo)?localGo:'go';
const dirty=capture('git',['status','--porcelain']).split('\n').filter(Boolean);
if(dirty.length&&!allowDirty){console.error('Release refused because the working tree is dirty. Commit/stash changes or rerun with --allow-dirty for a non-release test bundle.');process.exit(1)}

const releaseRoot=join(root,'release');
const bundleName=`webdev-mmorpg-${target}`;
const bundle=join(releaseRoot,bundleName);
const web=join(bundle,'web');
const legacy=join(bundle,'legacy');
const executable=`webdev-server${goos==='windows'?'.exe':''}`;
const adminExecutable=`webdev-admin${goos==='windows'?'.exe':''}`;
mkdirSync(releaseRoot,{recursive:true});
rmSync(bundle,{recursive:true,force:true});
mkdirSync(bundle,{recursive:true});

console.log(`Building Angular for ${target}...`);
run(node,[join(root,'frontend','node_modules','@angular','cli','bin','ng.js'),'build','--progress=false'],{cwd:join(root,'frontend'),env:{CI:'1'}});
console.log(`Building Go server for ${target}...`);
const commit=capture('git',['rev-parse','HEAD']);
const builtAt=new Date().toISOString();
const serverLdflags=`-s -w -X main.buildVersion=${applicationVersion} -X main.buildCommit=${commit} -X main.buildTime=${builtAt} -X main.buildTarget=${target}`;
run(go,['build','-trimpath',`-ldflags=${serverLdflags}`,'-o',join(bundle,executable),'./cmd/server'],{cwd:join(root,'backend'),env:{GOOS:goos,GOARCH:goarch,CGO_ENABLED:'0',GOCACHE:join(root,'.tools','go-cache')}});
console.log(`Building database administration tool for ${target}...`);
run(go,['build','-trimpath','-ldflags=-s -w','-o',join(bundle,adminExecutable),'./cmd/admin'],{cwd:join(root,'backend'),env:{GOOS:goos,GOARCH:goarch,CGO_ENABLED:'0',GOCACHE:join(root,'.tools','go-cache')}});

cpSync(join(root,'frontend','dist','webdev-mmorpg','browser'),web,{recursive:true});
mkdirSync(legacy,{recursive:true});
copyFileSync(join(root,'index.html'),join(legacy,'index.html'));
cpSync(join(root,'characters'),join(legacy,'characters'),{recursive:true});
cpSync(join(root,'jira'),join(legacy,'jira'),{recursive:true});

const referenceFiles=[join(root,'index.html'),join(root,'characters','registry.js'),...readdirSync(join(root,'backend','internal','store','migrations')).filter(name=>name.endsWith('.sql')).map(name=>join(root,'backend','internal','store','migrations',name))];
const runtimeAssets=new Set();
for(const source of referenceFiles)for(const asset of readFileSync(source,'utf8').match(/assets\/[A-Za-z0-9_./-]+/g)??[])runtimeAssets.add(asset);
for(const asset of [...runtimeAssets].sort()){
  const source=join(root,asset);
  if(!existsSync(source)||!lstatSync(source).isFile())throw new Error(`Runtime asset is missing: ${asset}`);
  const destination=join(legacy,asset);mkdirSync(dirname(destination),{recursive:true});copyFileSync(source,destination);
}

for(const document of ['README.md','ARCHITECTURE.md','WINDOWS_SETUP.md','TV_SOAK_RUNBOOK.md','BACKUP_RECOVERY.md','DATA_RETENTION.md','GAME_BOARD_VISUALS.md','PHASE_8_9_REPORT.md','PHASE_9_10_REPORT.md','PHASE_11_12_REPORT.md','PHASE_13_14_REPORT.md','PHASE_15_16_REPORT.md'])copyFileSync(join(root,document),join(bundle,document));
mkdirSync(join(bundle,'data'),{recursive:true});
mkdirSync(join(bundle,'backups'),{recursive:true});
const unixLauncher=`#!/bin/sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexport ANGULAR_DIST="$ROOT/web"\nexport LEGACY_GAME_DIR="$ROOT/legacy"\nexport DB_PATH="${'$'}{DB_PATH:-$ROOT/data/game.db}"\nexport ADDR="${'$'}{ADDR:-:8080}"\nexec "$ROOT/${executable}"\n`;
const windowsLauncher=`$ErrorActionPreference = "Stop"\n$Root = Split-Path -Parent $MyInvocation.MyCommand.Path\n$env:ANGULAR_DIST = Join-Path $Root "web"\n$env:LEGACY_GAME_DIR = Join-Path $Root "legacy"\nif (-not $env:DB_PATH) { $env:DB_PATH = Join-Path $Root "data\\game.db" }\nif (-not $env:ADDR) { $env:ADDR = ":8080" }\n& (Join-Path $Root "${executable}")\n`;
if(goos==='windows')writeFileSync(join(bundle,'start.ps1'),windowsLauncher);
else{writeFileSync(join(bundle,'start.sh'),unixLauncher);chmodSync(join(bundle,'start.sh'),0o755)}
writeFileSync(join(bundle,'RELEASE_README.txt'),`WEBDEV MMORPG ${applicationVersion} (${target})\n\nStart: ${goos==='windows'?'.\\start.ps1':'./start.sh'}\nAdmin: ${goos==='windows'?'.\\webdev-admin.exe':'./webdev-admin'}\nOpen: http://localhost:8080\nHealth: http://localhost:8080/api/health\nReadiness: http://localhost:8080/api/ready\nVersion: http://localhost:8080/api/version\nOperations: http://localhost:8080/operations\nTV soak: http://localhost:8080/diagnostics/soak.html\n\nSet JIRA_BASE_URL and JIRA_CREDENTIAL_KEYS in the process environment before starting. Generate the encryption key outside this folder and keep it secret. JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_JQL additionally enable the optional shared event stream. Never store credentials in this folder. Set APP_ENV=production behind HTTPS so per-viewer credential cookies are Secure. Set CORS_ALLOWED_ORIGINS only when serving a trusted frontend from a different origin. Read BACKUP_RECOVERY.md before using restore and DATA_RETENTION.md before applying retention maintenance.\n`);

const fileList=[];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()&&entry.name!=='release-manifest.json')fileList.push(path)}}
walk(bundle);
const manifest={name:'WEBDEV MMORPG',version:applicationVersion,target,commit,builtAt,dirty,allowDirty,runtimeAssetCount:runtimeAssets.size,mutableDirectories:['data/','backups/'],files:fileList.sort().map(path=>({path:relative(bundle,path).split(sep).join('/'),size:lstatSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
writeFileSync(join(bundle,'release-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
run(node,[join(root,'scripts','verify-release.mjs'),bundle]);
console.log(`Release bundle ready: ${bundle}`);

import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import process from 'node:process';

const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
const soakIndex=args.indexOf('--soak-report');
const targetIndex=args.indexOf('--target');
const soakArgument=soakIndex>=0?args[soakIndex+1]:'';
const soakPath=soakArgument&&!soakArgument.startsWith('--')?resolve(soakArgument):'';
const hostOS=process.platform==='win32'?'windows':process.platform;
const hostArch=process.arch==='arm64'?'arm64':'amd64';
const targetArgument=targetIndex>=0?args[targetIndex+1]:`${hostOS}-${hostArch}`;
const target=(targetArgument&&!targetArgument.startsWith('--')?targetArgument:'').toLowerCase();
if(!soakPath||!existsSync(soakPath)||!lstatSync(soakPath).isFile()||!/^(windows|linux|darwin)-(amd64|arm64)$/.test(target)){
  console.error('Usage: node scripts/verify-release-candidate.mjs --soak-report <signed-report.json> [--target windows-amd64]');
  process.exit(2);
}

const run=(command,commandArgs)=>{
  const result=spawnSync(command,commandArgs,{cwd:root,stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status??1);
};
const capture=spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});
if(capture.status!==0||capture.stdout.trim()){
  console.error('Release-candidate verification requires a clean working tree.');
  process.exit(1);
}

run(process.execPath,[join(root,'scripts','quality-gate.mjs')]);
run(process.execPath,[join(root,'scripts','verify-soak-report.mjs'),soakPath]);
run(process.execPath,[join(root,'scripts','build-release.mjs'),'--target',target]);

const bundle=join(root,'release',`webdev-mmorpg-${target}`);
const manifestPath=join(bundle,'release-manifest.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const certificate={
  schemaVersion:1,version:manifest.version,target,commit:manifest.commit,verifiedAt:new Date().toISOString(),qualityGate:'passed',
  soakReport:{file:basename(soakPath),sha256:createHash('sha256').update(readFileSync(soakPath)).digest('hex')}
};
const certificatePath=join(bundle,'release-certificate.json');
writeFileSync(certificatePath,`${JSON.stringify(certificate,null,2)}\n`);
const certificateBody=readFileSync(certificatePath);
manifest.certification={status:'passed',certificate:'release-certificate.json'};
manifest.files=(manifest.files??[]).filter(file=>file.path!=='release-certificate.json');
manifest.files.push({path:'release-certificate.json',size:lstatSync(certificatePath).size,sha256:createHash('sha256').update(certificateBody).digest('hex')});
manifest.files.sort((left,right)=>left.path.localeCompare(right.path));
writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
run(process.execPath,[join(root,'scripts','verify-release.mjs'),bundle]);
console.log(`Certified release candidate ready: ${bundle}`);

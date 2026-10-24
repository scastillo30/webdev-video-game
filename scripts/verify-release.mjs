import {createHash} from 'node:crypto';
import {lstatSync,readdirSync,readFileSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';

const bundle=resolve(process.argv[2]??'');
if(!process.argv[2]){console.error('Usage: node scripts/verify-release.mjs <release-directory>');process.exit(2)}

const manifestPath=join(bundle,'release-manifest.json');
let manifest;
try{manifest=JSON.parse(readFileSync(manifestPath,'utf8'))}catch(error){console.error(`Cannot read release manifest: ${error.message}`);process.exit(1)}

const files=[];
function walk(directory){
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error(`symbolic links are not allowed: ${path}`);
    if(entry.isDirectory())walk(path);
    else if(entry.isFile()&&path!==manifestPath)files.push(path);
  }
}

try{walk(bundle)}catch(error){console.error(error.message);process.exit(1)}
const actual=new Map(files.map(path=>{
  const name=relative(bundle,path).split(sep).join('/');
  return[name,{path:name,size:lstatSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}];
}));
const expected=new Map((manifest.files??[]).map(file=>[file.path,file]));
const mutableDirectories=(manifest.mutableDirectories??[]).map(directory=>directory.endsWith('/')?directory:`${directory}/`);
const isMutable=name=>mutableDirectories.some(directory=>name.startsWith(directory));
const errors=[];
for(const [name,file] of expected){const found=actual.get(name);if(!found)errors.push(`missing ${name}`);else if(found.size!==file.size||found.sha256!==file.sha256)errors.push(`checksum mismatch ${name}`)}
for(const name of actual.keys())if(!expected.has(name)&&!isMutable(name))errors.push(`unlisted ${name}`);
if(errors.length){console.error('Release verification FAILED');for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log(`Release verification PASS: ${actual.size} files for ${manifest.target} at commit ${manifest.commit}.`);

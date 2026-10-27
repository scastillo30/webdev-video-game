import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const outputDirectory=mkdtempSync(join(tmpdir(),'webdev-game-tests-'));
const outputFile=join(outputDirectory,'game-engine.test.mjs');

try{
  await build({
    stdin:{contents:"import './tests/game-engine.test.ts'; import './tests/holiday-decorations.test.ts';",resolveDir:process.cwd(),loader:'ts'},
    outfile:outputFile,
    bundle:true,
    platform:'node',
    format:'esm',
    target:'node22',
    logLevel:'warning'
  });
  const result=spawnSync(process.execPath,['--test',outputFile],{stdio:'inherit'});
  process.exitCode=result.status??1;
}finally{
  rmSync(outputDirectory,{recursive:true,force:true});
}

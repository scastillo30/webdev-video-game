import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateSoakReport} from './verify-soak-report.mjs';

const validReport=()=>({
  startedAt:'2026-10-24T10:00:00Z',completedAt:'2026-10-24T14:00:00Z',reason:'completed',passed:true,failures:[],
  samples:[{canvasCount:1},{canvasCount:1}],manualHardwareReviewRequired:false,maxLag:12,
  hardwareReview:{observer:'Release Operator',notes:'CPU, GPU, memory, thermals, and fan behavior remained stable.'}
});

test('accepts a completed and signed four-hour soak',()=>{
  const result=validateSoakReport(validReport());
  assert.deepEqual(result.failures,[]);
  assert.equal(result.elapsedMinutes,240);
});

test('rejects short and unsigned soak reports',()=>{
  const report=validReport();
  report.completedAt='2026-10-24T10:30:00Z';
  report.manualHardwareReviewRequired=true;
  report.hardwareReview={observer:'',notes:''};
  const result=validateSoakReport(report);
  assert.equal(result.failures.length,3);
  assert.ok(result.failures.some(failure=>failure.includes('below 240')));
  assert.ok(result.failures.some(failure=>failure.includes('not signed off')));
});

test('release verifier permits generated database files only in a declared mutable directory',()=>{
  const bundle=mkdtempSync(join(tmpdir(),'webdev-release-test-'));
  try{
    const application='immutable application';
    writeFileSync(join(bundle,'app.txt'),application);
    mkdirSync(join(bundle,'data'));
    writeFileSync(join(bundle,'data','game.db'),'runtime database');
    writeFileSync(join(bundle,'release-manifest.json'),JSON.stringify({
      target:'test-amd64',commit:'test',mutableDirectories:['data/'],files:[{
        path:'app.txt',size:Buffer.byteLength(application),sha256:createHash('sha256').update(application).digest('hex')
      }]
    }));
    const verifier=join(import.meta.dirname,'verify-release.mjs');
    const accepted=spawnSync(process.execPath,[verifier,bundle],{encoding:'utf8'});
    assert.equal(accepted.status,0,accepted.stderr);

    writeFileSync(join(bundle,'unexpected.txt'),'not allowed');
    const rejected=spawnSync(process.execPath,[verifier,bundle],{encoding:'utf8'});
    assert.equal(rejected.status,1);
    assert.match(rejected.stderr,/unlisted unexpected\.txt/);
  }finally{
    rmSync(bundle,{recursive:true,force:true});
  }
});

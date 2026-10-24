import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateSoakReport(report,minimumMinutes=240){
  const started=Date.parse(report.startedAt);
  const completed=Date.parse(report.completedAt);
  const elapsedMinutes=(completed-started)/60000;
  const failures=[];
  if(report.reason!=='completed')failures.push(`run ended as ${report.reason??'unknown'}, not completed`);
  if(report.passed!==true)failures.push('automated result is not PASS');
  if(!Array.isArray(report.failures)||report.failures.length)failures.push(`report contains ${report.failures?.length??'invalid'} automated failures`);
  if(!Number.isFinite(elapsedMinutes)||elapsedMinutes<minimumMinutes)failures.push(`duration ${Number.isFinite(elapsedMinutes)?elapsedMinutes.toFixed(1):'invalid'} minutes is below ${minimumMinutes}`);
  if(!Array.isArray(report.samples)||report.samples.length<2)failures.push('report does not contain enough samples');
  if(report.manualHardwareReviewRequired!==false)failures.push('manual hardware review is not signed off');
  if(!report.hardwareReview||!String(report.hardwareReview.observer??'').trim()||!String(report.hardwareReview.notes??'').trim())failures.push('hardwareReview.observer and hardwareReview.notes are required');
  return{failures,elapsedMinutes};
}

function main(){
  const args=process.argv.slice(2);
  const reportArg=args.find(arg=>!arg.startsWith('--'));
  const minimumIndex=args.indexOf('--minimum-minutes');
  const minimumMinutes=minimumIndex>=0?Number(args[minimumIndex+1]):240;
  if(!reportArg||!Number.isFinite(minimumMinutes)||minimumMinutes<=0){console.error('Usage: node scripts/verify-soak-report.mjs <report.json> [--minimum-minutes 240]');process.exit(2)}
  const reportPath=resolve(reportArg);
  let report;
  try{report=JSON.parse(readFileSync(reportPath,'utf8'))}catch(error){console.error(`Invalid soak report: ${error.message}`);process.exit(1)}
  const result=validateSoakReport(report,minimumMinutes);
  if(result.failures.length){console.error(`Soak report FAILED: ${reportPath}`);for(const failure of result.failures)console.error(`- ${failure}`);process.exit(1)}
  console.log(`Soak report PASS: ${result.elapsedMinutes.toFixed(1)} minutes, ${report.samples.length} samples, ${report.maxLag??report.maxLagMs??'n/a'} ms maximum event-loop lag.`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();

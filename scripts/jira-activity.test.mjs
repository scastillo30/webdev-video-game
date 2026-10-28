import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const loadRuntime=()=>{
  const context={URL,clearInterval,console,location:{href:'http://office.test/'},setInterval};
  context.window=context;
  vm.runInNewContext(readFileSync(new URL('../jira/activity.js',import.meta.url),'utf8'),context,{filename:'jira/activity.js'});
  return context.window.JiraActivity;
};

test('an Office refresh that arrives during startup is replayed after the active poll',async()=>{
  const JiraActivity=loadRuntime();
  let releaseFirst;
  const firstResponse=new Promise(resolve=>{releaseFirst=resolve});
  let calls=0;
  const states=[];
  const accepted=[];
  const controller=new JiraActivity.ActivityController({
    config:{pollIntervalMs:60_000},
    adapter:{fetchActivities:async()=>++calls===1?firstResponse:{connection:'live',events:[{eventId:'second'}]}},
    queue:{ingest:events=>{accepted.push(...events);return events}},
    onConnection:state=>states.push(state.state)
  });

  const startup=controller.poll();
  await Promise.resolve();
  await controller.poll();
  releaseFirst({connection:'disconnected',events:[]});
  await startup;

  assert.equal(calls,2);
  assert.deepEqual(states,['loading','disconnected','loading','live']);
  assert.deepEqual(accepted,[{eventId:'second'}]);
});

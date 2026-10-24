import assert from 'node:assert/strict';
import test from 'node:test';
import {CharacterPathfinding} from '../src/app/features/game/engine/character-pathfinding';
import {CharacterStateMachine,stateForStatus} from '../src/app/features/game/engine/character-state-machine';
import {chooseFeaturedIssue} from '../src/app/features/game/engine/featured-ticket';
import {JiraIssueSnapshot} from '../src/app/core/jira/jira.models';
import {GameProfile,SpectatorItem} from '../src/app/features/game/engine/game.models';
import {SpectatorDirectorService} from '../src/app/features/game/services/spectator-director.service';

const issue=(key:string,overrides:Partial<JiraIssueSnapshot>={}):JiraIssueSnapshot=>({
  issueKey:key,summary:key,issueType:'Task',status:'In Progress',statusCategory:'indeterminate',
  assigneeId:'user',assigneeName:'User',priority:null,projectKey:'PLANNA',updatedAt:'2026-10-20T12:00:00Z',
  dueDate:null,issueUrl:`https://example.invalid/browse/${key}`,...overrides
});

test('A* avoids blocked and reserved tiles',()=>{
  const pathfinder=new CharacterPathfinding(8,8,new Set(['3,2','3,3','3,4']));
  const path=pathfinder.find({x:2,y:3},{x:5,y:3},new Set(['2,4']));
  assert.ok(path.length>3);
  assert.equal(path.some(point=>point.x===3&&point.y>=2&&point.y<=4),false);
  assert.equal(path.some(point=>point.x===2&&point.y===4),false);
  assert.deepEqual(path.at(-1),{x:5,y:3});
});

test('state machine and status classifier retain bounded states',()=>{
  const machine=new CharacterStateMachine();
  assert.equal(machine.transition('WALKING'),true);
  assert.equal(machine.transition('WORKING'),true);
  assert.equal(machine.transition('WORKING'),false);
  assert.equal(stateForStatus('Blocked','indeterminate'),'BLOCKED');
  assert.equal(stateForStatus('Code Review','indeterminate'),'REVIEWING');
  assert.equal(stateForStatus('Done','done'),'CELEBRATING');
});

test('featured ticket policy is deterministic',()=>{
  const tickets=[
    issue('PLANNA-1',{updatedAt:'2026-10-22T12:00:00Z',priority:'Low',dueDate:'2026-11-10'}),
    issue('PLANNA-2',{updatedAt:'2026-10-21T12:00:00Z',priority:'Highest',dueDate:'2026-11-20'}),
    issue('PLANNA-3',{updatedAt:'2026-10-20T12:00:00Z',priority:'Medium',dueDate:'2026-10-30'})
  ];
  assert.equal(chooseFeaturedIssue(tickets,'recently-updated')?.issueKey,'PLANNA-1');
  assert.equal(chooseFeaturedIssue(tickets,'highest-priority')?.issueKey,'PLANNA-2');
  assert.equal(chooseFeaturedIssue(tickets,'nearest-due-date')?.issueKey,'PLANNA-3');
});

test('spectator queue deduplicates events and rotates fairly',()=>{
  Object.assign(globalThis,{window:globalThis});
  const profile=(id:string):GameProfile=>({characterId:id,displayName:id,characterClass:'Tester',jiraAccountId:`user-${id}`,homeLocation:'command-dais',workstation:'planning-table',miniatureAsset:'assets/test.webp',portraitAsset:'assets/test.webp',enabled:true});
  const item=(character:GameProfile,eventId:string):SpectatorItem=>({character,groupedEventCount:1,event:{eventId,issueKey:`ISSUE-${eventId}`,authorId:character.jiraAccountId,authorName:character.displayName,assigneeId:null,assigneeName:null,action:'UPDATED',previousStatus:null,newStatus:null,currentStatus:'In Progress',occurredAt:'2026-10-24T12:00:00Z',issueSummary:'Test',issueUrl:'https://example.invalid'}});
  const director=new SpectatorDirectorService();
  let latest:any;
  const subscription=director.state$.subscribe(state=>latest=state);
  const alpha=profile('alpha'),beta=profile('beta');
  director.configure(true,300);
  director.ingest([item(alpha,'1'),item(beta,'2'),item(alpha,'1')]);
  const first=latest.focusCharacterId;
  director.next();
  const second=latest.focusCharacterId;
  assert.notEqual(first,second);
  assert.deepEqual(new Set([first,second]),new Set(['alpha','beta']));
  assert.equal(latest.pending,0);
  director.stop();subscription.unsubscribe();
});

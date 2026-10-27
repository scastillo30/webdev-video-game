import assert from 'node:assert/strict';
import test from 'node:test';
import {BOARD_CHARACTER_IDS,boardCharacterAsset} from '../src/app/features/game/engine/board-character-assets';
import {CharacterPathfinding} from '../src/app/features/game/engine/character-pathfinding';
import {COMMANDER_SEQUENCES,COMMANDER_WALK,GUARDIAN_WALK,HEALER_WALK,DirectionalWalk} from '../src/app/features/game/engine/directional-walk';
import {CASTLE_ANCHORS,CASTLE_COLUMNS,CASTLE_ROWS,CastleNavigationModel} from '../src/app/features/game/engine/castle-navigation';
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

test('Commander walk faces four directions and preserves facing on stop',()=>{
  const walk=new DirectionalWalk();
  for(const [target,walking,idle,flip] of [[{x:0,y:48},12,0,false],[{x:-48,y:0},20,6,true],[{x:48,y:0},20,6,false],[{x:0,y:-48},16,3,false]] as const){
    walk.begin({x:0,y:0},target);
    assert.equal(walk.frame,walking);assert.equal(walk.flipX,flip);
    assert.equal(walk.stop(),idle);
  }
});

test('Commander gait follows distance, survives a turn, and cannot advance while stopped',()=>{
  const walk=new DirectionalWalk();
  walk.begin({x:0,y:0},{x:48,y:0});
  assert.equal(walk.step({x:12,y:0}),21);
  assert.equal(walk.step({x:12,y:0}),21,'no movement means no foot motion, including pause/resume');
  walk.step({x:24,y:0});
  walk.begin({x:24,y:0},{x:24,y:-48});
  assert.equal(walk.frame,18,'turn keeps stride phase');
  assert.equal(walk.step({x:24,y:-24}),16,'cycle wraps at 48 pixels');
  assert.equal(walk.stop(),3);
  assert.equal(walk.step({x:99,y:99}),3);
});

test('Commander 33-pose layout skips empty tiles and preserves size with the 64px runtime master',()=>{
  const frames=Object.values(COMMANDER_SEQUENCES).flatMap(action=>Object.values(action).flat());
  assert.equal(frames.length,33);assert.equal(new Set(frames).size,33);
  assert.deepEqual(frames,[0,1,2,3,4,5,6,7,8,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,36,37,38]);
  assert.equal(COMMANDER_WALK.frameWidth,64);assert.equal(COMMANDER_WALK.frameHeight,64);
  assert.equal(COMMANDER_WALK.frameHeight*COMMANDER_WALK.displayScale,32*2.4);
  assert.equal(COMMANDER_WALK.footOrigin,31/32);
});

test('Commander idle, attack and hurt have bounded clocks and recover to idle',()=>{
  const walk=new DirectionalWalk();
  assert.equal(walk.tick(260),1);assert.equal(walk.tick(260),2);assert.equal(walk.tick(260),0);
  walk.play('attack');assert.equal(walk.frame,24);
  assert.equal(walk.tick(120),25);assert.equal(walk.tick(120),26);assert.equal(walk.tick(120),0);
  walk.face(-1,0);walk.play('hurt');assert.equal(walk.frame,38);assert.equal(walk.flipX,true);
  assert.equal(walk.tick(420),6);assert.equal(walk.currentAction,'idle');
  walk.begin({x:0,y:0},{x:0,y:-48});walk.play('attack');assert.equal(walk.currentAction,'walk');
});

test('Guardian owns a separate cube-wanderer sprite config without changing Commander or Rogue',()=>{
  const guardian=boardCharacterAsset('guardian','fallback').directional;
  assert.equal(guardian,GUARDIAN_WALK);assert.equal(guardian.characterId,'cube-wanderer');
  assert.notEqual(guardian.key,COMMANDER_WALK.key);assert.notEqual(guardian.path,COMMANDER_WALK.path);
  assert.equal(guardian.abilityName,'cube-reveal');assert.equal(COMMANDER_WALK.abilityName,'sword-flourish');
  assert.equal(guardian.frameHeight*guardian.displayScale,COMMANDER_WALK.frameHeight*COMMANDER_WALK.displayScale);
  assert.equal(boardCharacterAsset('rogue','fallback').directional?.abilityName,'pointing-glow');
});

test('Guardian raises the palm, holds the cube, lowers the hand, and returns to idle',()=>{
  const guardian=new DirectionalWalk(GUARDIAN_WALK);guardian.play('attack');
  assert.equal(guardian.frame,24);assert.equal(guardian.tick(180),25);
  assert.equal(guardian.tick(220),26);assert.equal(guardian.tick(1299),26);
  assert.equal(guardian.tick(1),25);assert.equal(guardian.tick(180),24);
  assert.equal(guardian.tick(140),0);assert.equal(guardian.currentAction,'idle');
  guardian.face(-1,0);guardian.play('attack');guardian.tick(400);
  assert.equal(guardian.frame,32);assert.equal(guardian.flipX,true);
  guardian.begin({x:0,y:0},{x:0,y:-48});assert.equal(guardian.currentAction,'walk');assert.equal(guardian.frame,16);
});

test('Guardian idle reveal repeats after nine stationary seconds; Commander never auto-casts',()=>{
  const guardian=new DirectionalWalk(GUARDIAN_WALK),commander=new DirectionalWalk();
  guardian.tick(8999);assert.equal(guardian.currentAction,'idle');
  guardian.tick(1);assert.equal(guardian.currentAction,'attack');
  commander.tick(9000);assert.equal(commander.currentAction,'idle');
  guardian.stop();guardian.begin({x:0,y:0},{x:48,y:0});guardian.tick(9000);
  assert.equal(guardian.currentAction,'walk');
});

test('Healer has an independent healing timeline and the approved board footprint',()=>{
  assert.equal(boardCharacterAsset('healer','fallback').directional,HEALER_WALK);
  assert.equal(HEALER_WALK.characterId,'healer');assert.equal(HEALER_WALK.abilityName,'healing-pulse');
  assert.notEqual(HEALER_WALK.key,GUARDIAN_WALK.key);assert.notEqual(HEALER_WALK.path,COMMANDER_WALK.path);
  assert.equal(HEALER_WALK.frameHeight*HEALER_WALK.displayScale,COMMANDER_WALK.frameHeight*COMMANDER_WALK.displayScale);
  const healer=new DirectionalWalk(HEALER_WALK);healer.play('attack');assert.equal(healer.frame,24);
  assert.equal(healer.tick(200),25);assert.equal(healer.tick(240),26);
  assert.equal(healer.tick(999),26);assert.equal(healer.tick(1),25);
  assert.equal(healer.tick(180),24);assert.equal(healer.tick(180),0);
  assert.equal(healer.currentAction,'idle');
});

test('Healer casts after ten stationary seconds, preserves facing, and cancels casting for movement',()=>{
  const healer=new DirectionalWalk(HEALER_WALK);healer.tick(9999);assert.equal(healer.currentAction,'idle');
  healer.tick(1);assert.equal(healer.currentAction,'attack');
  healer.face(-1,0);healer.tick(440);assert.equal(healer.frame,32);assert.equal(healer.flipX,true);
  healer.begin({x:0,y:0},{x:0,y:-48});assert.equal(healer.currentAction,'walk');assert.equal(healer.frame,16);
});

test('A* avoids blocked and reserved tiles',()=>{
  const pathfinder=new CharacterPathfinding(8,8,new Set(['3,2','3,3','3,4']));
  const path=pathfinder.find({x:2,y:3},{x:5,y:3},new Set(['2,4']));
  assert.ok(path.length>3);
  assert.equal(path.some(point=>point.x===3&&point.y>=2&&point.y<=4),false);
  assert.equal(path.some(point=>point.x===2&&point.y===4),false);
  assert.deepEqual(path.at(-1),{x:5,y:3});
});

test('board presentation maps every roster character to a separate pixel asset',()=>{
  const expected=['bard','commander','courier','guardian','healer','mage','rogue','swordsman'];
  assert.deepEqual([...BOARD_CHARACTER_IDS].sort(),expected);
  const paths=expected.map(characterId=>boardCharacterAsset(characterId,'fallback').path);
  assert.equal(new Set(paths).size,expected.length);
  assert.equal(paths.every(path=>path.startsWith('/assets/game-board/characters/v001/')),true);
  assert.equal(boardCharacterAsset('custom-character','/legacy-game/custom.webp').path,'/legacy-game/custom.webp');
});

test('castle navigation keeps roster anchors and interaction slots walkable',()=>{
  const navigation=new CastleNavigationModel();
  for(const [name,point] of Object.entries(CASTLE_ANCHORS))assert.equal(navigation.isWalkable(point),true,`${name} should be walkable`);
  for(const name of ['planning-table','review-table','library','quest-board','ops-console','frontend-desk','api-orb','design-table','support-desk','qa-board','automation-console']){
    const station=navigation.station(name,{x:15,y:13},new Set());
    assert.ok(station,`${name} should provide an interaction slot`);
    assert.equal(navigation.isWalkable(station.point),true);
  }
});

test('castle pathfinding routes around furniture and honors reserved station slots',()=>{
  const navigation=new CastleNavigationModel();
  const pathfinder=new CharacterPathfinding(CASTLE_COLUMNS,CASTLE_ROWS,navigation.blocked);
  const start={x:11,y:7},destination={x:19,y:7};
  const path=pathfinder.find(start,destination,new Set());
  assert.ok(path.length>Math.abs(destination.x-start.x));
  assert.equal(path.some(point=>navigation.blocked.has(`${point.x},${point.y}`)),false);
  const first=navigation.station('planning-table',start,new Set());
  assert.ok(first);
  const second=navigation.station('planning-table',start,new Set([`${first.point.x},${first.point.y}`]));
  assert.ok(second);
  assert.notDeepEqual(second.point,first.point);
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

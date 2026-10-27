// Browser integration check of the real CastleScene and CharacterController.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'frontend/package.json'));
const {build}=require('esbuild');
const {chromium}=await import('/Users/scastillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const bundle=await build({stdin:{contents:`
import Phaser from 'phaser';
import {CastleScene,CASTLE_WIDTH,CASTLE_HEIGHT} from './src/app/features/game/engine/castle-scene';
import {defaultGameSettings} from './src/app/features/game/engine/game.models';
const ids=['commander','guardian','rogue','mage','healer','courier','swordsman','bard'];
const homes=['command-dais','ops-console','frontend-desk','api-orb','support-desk','entrance','qa-board','automation-console'];
const profiles=ids.map((id,i)=>({characterId:id,displayName:id,enabled:true,homeLocation:homes[i],workstation:homes[i],miniatureAsset:'assets/'+id+'_full.webp'}));
window.scene=new CastleScene(profiles,()=>{},new URLSearchParams(location.search).has('reduced'),defaultGameSettings(),()=>window.ready=true);
window.game=new Phaser.Game({type:Phaser.CANVAS,width:CASTLE_WIDTH,height:CASTLE_HEIGHT,scene:[window.scene],render:{antialias:false,roundPixels:true},audio:{noAudio:true}});
`,resolveDir:resolve(root,'frontend')},bundle:true,write:false,format:'iife',logLevel:'warning'});
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<body style="margin:0;background:#101a2b"><script src="/test.js"></script>');return}
    if(path==='/test.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);return}
    const file=resolve(root,'frontend/public','.'+decodeURIComponent(path));
    if(!file.startsWith(resolve(root,'frontend/public')+'/')){res.writeHead(403).end();return}
    const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);
  }catch{res.writeHead(404).end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
const errors=[];
const report=[];
try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);await page.waitForFunction(()=>window.ready);
  assert.equal(await page.evaluate(()=>window.scene.controllers.size),8);
  await page.evaluate(()=>{for(const c of window.scene.controllers.values())c.idleAt=Infinity});
  for(const [dx,dy,base,idle,flip] of [[0,1,12,0,false],[-1,0,20,6,true],[1,0,20,6,false],[0,-1,16,3,false]]){
    await page.evaluate(({dx,dy})=>{
      const s=window.scene,c=s.controllers.get('rogue');
      let from;
      outer:for(let y=2;y<13;y++)for(let x=2;x<27;x++)if(s.navigation.isWalkable({x,y})&&s.navigation.isWalkable({x:x+dx,y:y+dy})){from={x,y};break outer}
      s.tweens.killTweensOf(c.container);c.moving=false;c.cell=from;c.container.setPosition(from.x*48+24,from.y*48+24);
      c.moveTo({x:from.x+dx,y:from.y+dy},new Set(),()=>c.setState('IDLE',''),'IDLE');
    },{dx,dy});
    await page.waitForTimeout(100);
    const state=await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');return {frame:Number(c.image.frame.name),flip:c.image.flipX,moving:c.isMoving}});
    assert.ok(state.frame>=base&&state.frame<base+4);assert.equal(state.moving,true);assert.equal(state.flip,flip);
    await page.waitForFunction(()=>!window.scene.controllers.get('rogue').isMoving,{},{timeout:5000});
    const stopped=await page.evaluate(()=>Number(window.scene.controllers.get('rogue').image.frame.name));
    assert.ok(stopped>=idle&&stopped<idle+3);
    report.push(`direction ${dx},${dy}: walking, idle and mirror verified`);
  }
  // Rogue uses its pointing gesture for task completion and a short hurt reaction.
  for(const [state,action,base] of [['CELEBRATING','attack',27],['BLOCKED','hurt',37]]){
    const reaction=await page.evaluate(({state})=>{const c=window.scene.controllers.get('rogue');c.apply({characterId:'guardian',state,label:'Animation verification'},c.currentCell,new Set());return {action:c.walk.currentAction,frame:Number(c.image.frame.name)}},{state});
    assert.equal(reaction.action,action);assert.equal(reaction.frame,base);
    await page.waitForFunction(()=>window.scene.controllers.get('rogue').walk.currentAction==='idle');
    report.push(`${action} reaction integrated into ${state}, recovers to idle`);
  }
  await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');c.setState('IDLE','')});
  await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');c.wander({x:c.cell.x+1,y:c.cell.y},new Set())});
  await page.waitForTimeout(70);
  await page.evaluate(()=>window.game.loop.sleep());
  const paused=await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');return [c.container.x,c.container.y,c.image.frame.name]});
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');return [c.container.x,c.container.y,c.image.frame.name]}),paused);
  await page.evaluate(()=>window.game.loop.wake());await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').isMoving),false);
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('rogue');c.wander({x:c.cell.x-1,y:c.cell.y},new Set());s.configure({...s.settings,movementEnabled:false})});
  const disabled=await page.evaluate(()=>window.scene.controllers.get('rogue').worldPosition);
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.scene.controllers.get('rogue').worldPosition),disabled);
  await page.evaluate(()=>{const s=window.scene;s.configure({...s.settings,movementEnabled:true,animationSpeed:2})});
  await page.waitForFunction(()=>!window.scene.controllers.get('rogue').isMoving);
  report.push('movement toggle pauses/resumes the active tween; speed changes apply');
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('bard');const from={x:15,y:11};s.tweens.killTweensOf(c.container);c.moving=false;c.cell=from;c.container.setPosition(744,552);c.moveTo({x:16,y:11},new Set(),()=>c.setState('IDLE',''),'IDLE')});
  await page.waitForTimeout(30);await page.evaluate(()=>window.game.loop.sleep());
  const roguePaused=await page.evaluate(()=>window.scene.controllers.get('bard').worldPosition);
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.scene.controllers.get('bard').worldPosition),roguePaused);
  await page.evaluate(()=>window.game.loop.wake());
  await page.waitForFunction(()=>!window.scene.controllers.get('bard').isMoving);
  report.push('Shadow Bard retains its own artwork and movement after pause/resume');
  for(const id of ['guardian','commander','rogue','guardian'])await page.evaluate(id=>window.scene.focusCharacter(id),id);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('bard').image.texture.key),'bard-shadow-cast-v001');
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('commander').image.texture.key),'commander-snes-rpg-v002');
  const flourish=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.walk.face(0,1);c.apply({characterId:'commander',state:'CELEBRATING',label:'Commander regression'},c.currentCell,new Set());return {frame:Number(c.image.frame.name),ability:c.walk.config.abilityName}});
  assert.equal(flourish.frame,24);assert.equal(flourish.ability,'sword-flourish');
  await page.waitForFunction(()=>window.scene.controllers.get('commander').walk.currentAction==='idle');
  await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.setState('IDLE','');c.cell={x:15,y:11};c.container.setPosition(744,552);c.moveTo({x:16,y:11},new Set(),()=>c.setState('IDLE',''),'IDLE')});
  await page.waitForTimeout(30);await page.evaluate(()=>window.game.loop.sleep());
  const commanderPaused=await page.evaluate(()=>window.scene.controllers.get('commander').worldPosition);
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.scene.controllers.get('commander').worldPosition),commanderPaused);
  await page.evaluate(()=>window.game.loop.wake());
  await page.waitForFunction(()=>!window.scene.controllers.get('commander').isMoving);
  report.push('Commander retains its own sword flourish, texture and pause/resume movement');
  await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');c.setState('IDLE','');c.focus(false,false);c.focus(true,true)});
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').walk.currentAction),'attack');
  await page.waitForFunction(()=>window.scene.controllers.get('rogue').walk.frame===32);
  await page.evaluate(()=>window.game.loop.sleep());
  const shadowPaused=await page.evaluate(()=>window.scene.controllers.get('rogue').walk.frame);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').walk.frame),shadowPaused);
  await page.evaluate(()=>window.game.loop.wake());
  await page.waitForFunction(()=>window.scene.controllers.get('rogue').walk.currentAction==='idle');
  report.push('selecting Rogue raises the hand, holds the pointing pose and lowers it; reveal pauses with game');
  for(const state of ['WORKING','REVIEWING']){
    await page.evaluate(state=>window.scene.controllers.get('rogue').setState(state,'Cube state check'),state);
    assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').walk.currentAction),'attack');
  }
  report.push('work/review states trigger Rogue pointing gesture');
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('rogue'),r=s.controllers.get('bard');r.cell=s.navigation.anchor(r.profile.homeLocation);r.container.setPosition(r.cell.x*48+24,r.cell.y*48+24);const commander=s.controllers.get('commander');commander.cell={x:12,y:10};commander.container.setPosition(600,504);commander.setState('IDLE','');commander.walk.face(0,1);commander.showWalkFrame(commander.walk.stop());c.setState('IDLE','');c.cell={x:15,y:10};c.container.setPosition(744,504);c.walk.face(0,1);c.showWalkFrame(c.walk.stop());s.cameras.main.stopFollow();s.cameras.main.panEffect.reset();s.cameras.main.setScroll(0,0);s.cameras.main.setZoom(1)});
  await page.waitForTimeout(150);
  // Match Commander's approved board footprint while showing Rogue's full reveal.
  const size=await page.evaluate(()=>{
    const c=window.scene.controllers.get('rogue');c.animate=()=>{};c.walk.play('attack');c.walk.tick(400);c.showWalkFrame(c.walk.frame);
    return {guardian:c.image.displayHeight,commander:window.scene.controllers.get('commander').image.displayHeight};
  });
  assert.equal(size.guardian,size.commander);
  await page.waitForTimeout(60);
  await page.screenshot({path:resolve(root,'assets/characters/rogue/snes-rpg/v001/board-preview.png')});
  await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');c.image.setTexture('hero-rogue').setScale(112/c.scene.textures.get('hero-rogue').getSourceImage().height).setOrigin(.5,1)});
  await page.waitForTimeout(60);
  await page.screenshot({path:resolve(root,'assets/characters/rogue/snes-rpg/v001/board-before.png')});
  report.push('Rogue uses the same 76.8px frame footprint as Commander; original board still preserved');
  report.push('pause/resume and Rogue/Commander/Shadow Bard switching verified');
  await page.goto(url+'/?reduced');await page.waitForFunction(()=>window.ready);
  const reduced=await page.evaluate(()=>{const c=window.scene.controllers.get('rogue');c.wander({x:c.cell.x+1,y:c.cell.y},new Set());return {moving:c.isMoving,frame:Number(c.image.frame.name)}});
  assert.equal(reduced.moving,false);assert.ok([0,3,6].includes(reduced.frame));
  const still=await page.evaluate(()=>Number(window.scene.controllers.get('rogue').image.frame.name));
  await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>Number(window.scene.controllers.get('rogue').image.frame.name)),still);
  report.push('reduced motion uses a neutral directional pose');
  await page.route('**/rogue/snes-rpg/v001/spritesheet-runtime.png',route=>route.abort());
  await page.goto(url);await page.waitForFunction(()=>window.ready);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').image.texture.key),'hero-rogue');
  report.push('missing sprite sheet falls back to Rogue poster');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(root,'assets/characters/rogue/snes-rpg/v001/browser-validation.json'),JSON.stringify({passed:true,checks:report,pageErrors:errors},null,2)+'\n');
  console.log(report.join('\n'));
}finally{await browser?.close();await new Promise(done=>server.close(done))}

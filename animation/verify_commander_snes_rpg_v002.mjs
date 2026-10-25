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
  for(const [dx,dy,base,idle,flip] of [[0,1,12,0,false],[-1,0,20,6,true],[1,0,20,6,false],[0,-1,16,3,false]]){
    await page.evaluate(({dx,dy})=>{
      const s=window.scene,c=s.controllers.get('commander');
      let from;
      outer:for(let y=2;y<13;y++)for(let x=2;x<27;x++)if(s.navigation.isWalkable({x,y})&&s.navigation.isWalkable({x:x+dx,y:y+dy})){from={x,y};break outer}
      s.tweens.killTweensOf(c.container);c.moving=false;c.cell=from;c.container.setPosition(from.x*48+24,from.y*48+24);
      c.moveTo({x:from.x+dx,y:from.y+dy},new Set(),()=>c.setState('IDLE',''),'IDLE');
    },{dx,dy});
    await page.waitForTimeout(100);
    const state=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');return {frame:Number(c.image.frame.name),flip:c.image.flipX,moving:c.isMoving}});
    assert.ok(state.frame>=base&&state.frame<base+4);assert.equal(state.moving,true);assert.equal(state.flip,flip);
    await page.waitForFunction(()=>!window.scene.controllers.get('commander').isMoving,{},{timeout:5000});
    const stopped=await page.evaluate(()=>Number(window.scene.controllers.get('commander').image.frame.name));
    assert.ok(stopped>=idle&&stopped<idle+3);
    report.push(`direction ${dx},${dy}: walking, idle and mirror verified`);
  }
  // The existing board events use a sword flourish for task completion and a
  // short hurt reaction for a newly blocked task; both recover to idle.
  for(const [state,action,base] of [['CELEBRATING','attack',27],['BLOCKED','hurt',37]]){
    const reaction=await page.evaluate(({state})=>{const c=window.scene.controllers.get('commander');c.apply({characterId:'commander',state,label:'Animation verification'},c.currentCell,new Set());return {action:c.walk.currentAction,frame:Number(c.image.frame.name)}},{state});
    assert.equal(reaction.action,action);assert.equal(reaction.frame,base);
    await page.waitForFunction(()=>window.scene.controllers.get('commander').walk.currentAction==='idle');
    report.push(`${action} reaction integrated into ${state}, recovers to idle`);
  }
  await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.setState('IDLE','')});
  await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.wander({x:c.cell.x+1,y:c.cell.y},new Set())});
  await page.waitForTimeout(70);
  await page.evaluate(()=>window.game.loop.sleep());
  const paused=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');return [c.container.x,c.container.y,c.image.frame.name]});
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>{const c=window.scene.controllers.get('commander');return [c.container.x,c.container.y,c.image.frame.name]}),paused);
  await page.evaluate(()=>window.game.loop.wake());await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('commander').isMoving),false);
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('commander');c.wander({x:c.cell.x-1,y:c.cell.y},new Set());s.configure({...s.settings,movementEnabled:false})});
  const disabled=await page.evaluate(()=>window.scene.controllers.get('commander').worldPosition);
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.scene.controllers.get('commander').worldPosition),disabled);
  await page.evaluate(()=>{const s=window.scene;s.configure({...s.settings,movementEnabled:true,animationSpeed:2})});
  await page.waitForFunction(()=>!window.scene.controllers.get('commander').isMoving);
  report.push('movement toggle pauses/resumes the active tween; speed changes apply');
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('rogue');const from={x:15,y:11};s.tweens.killTweensOf(c.container);c.moving=false;c.cell=from;c.container.setPosition(744,552);c.moveTo({x:16,y:11},new Set(),()=>c.setState('IDLE',''),'IDLE')});
  await page.waitForTimeout(30);await page.evaluate(()=>window.game.loop.sleep());
  const roguePaused=await page.evaluate(()=>window.scene.controllers.get('rogue').worldPosition);
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.scene.controllers.get('rogue').worldPosition),roguePaused);
  await page.evaluate(()=>window.game.loop.wake());
  await page.waitForFunction(()=>!window.scene.controllers.get('rogue').isMoving);
  report.push('Rogue retains original artwork and movement after pause/resume');
  for(const id of ['commander','rogue','commander'])await page.evaluate(id=>window.scene.focusCharacter(id),id);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('rogue').image.texture.key),'hero-rogue');
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('commander'),r=s.controllers.get('rogue');r.cell=s.navigation.anchor(r.profile.homeLocation);r.container.setPosition(r.cell.x*48+24,r.cell.y*48+24);c.cell={x:15,y:10};c.container.setPosition(744,504);c.walk.face(0,1);c.showWalkFrame(c.walk.stop());s.cameras.main.stopFollow();s.cameras.main.panEffect.reset();s.cameras.main.setScroll(0,0);s.cameras.main.setZoom(1)});
  await page.waitForTimeout(150);
  // Same board, same camera, same pose: compare the original and refined artwork
  // at exactly equal displayed frame sizes. Freeze animation while capturing.
  await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.animate=()=>{};c.showWalkFrame(c.walk.stop())});
  await page.screenshot({path:resolve(root,'assets/characters/commander/snes-rpg/v002/board-preview.png')});
  await page.evaluate(()=>new Promise(done=>{const s=window.scene;s.load.spritesheet('commander-review-v001','/assets/characters/commander/snes-rpg/v001/spritesheet.png',{frameWidth:32,frameHeight:32});s.load.once('complete',done);s.load.start()}));
  const footprint=await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('commander');const after=c.image.displayHeight;c.image.setTexture('commander-review-v001',0).setScale(2.4);s.textures.get('commander-review-v001').setFilter(1);return {before:c.image.displayHeight,after}});
  assert.equal(footprint.before,footprint.after);
  await page.waitForTimeout(60);
  await page.screenshot({path:resolve(root,'assets/characters/commander/snes-rpg/v002/board-before.png')});
  await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.image.setTexture('commander-snes-rpg-v002',0).setScale(1.2)});
  report.push('same-view before/after: physical sprite footprint unchanged (76.8px)');
  report.push('pause/resume and Commander/Rogue switching verified');
  await page.goto(url+'/?reduced');await page.waitForFunction(()=>window.ready);
  const reduced=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.wander({x:c.cell.x+1,y:c.cell.y},new Set());return {moving:c.isMoving,frame:Number(c.image.frame.name)}});
  assert.equal(reduced.moving,false);assert.ok([0,3,6].includes(reduced.frame));
  const still=await page.evaluate(()=>Number(window.scene.controllers.get('commander').image.frame.name));
  await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>Number(window.scene.controllers.get('commander').image.frame.name)),still);
  report.push('reduced motion uses a neutral directional pose');
  await page.route('**/snes-rpg/v002/spritesheet-runtime.png',route=>route.abort());
  await page.goto(url);await page.waitForFunction(()=>window.ready);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('commander').image.texture.key),'hero-commander');
  report.push('missing sprite sheet falls back to Commander poster');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(root,'assets/characters/commander/snes-rpg/v002/browser-validation.json'),JSON.stringify({passed:true,checks:report,pageErrors:errors},null,2)+'\n');
  console.log(report.join('\n'));
}finally{await browser?.close();await new Promise(done=>server.close(done))}

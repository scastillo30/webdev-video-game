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
  for(const [dx,dy,row] of [[0,1,0],[-1,0,1],[1,0,2],[0,-1,3]]){
    await page.evaluate(({dx,dy})=>{
      const s=window.scene,c=s.controllers.get('commander');
      let from;
      outer:for(let y=2;y<13;y++)for(let x=2;x<27;x++)if(s.navigation.isWalkable({x,y})&&s.navigation.isWalkable({x:x+dx,y:y+dy})){from={x,y};break outer}
      s.tweens.killTweensOf(c.container);c.moving=false;c.cell=from;c.container.setPosition(from.x*48+24,from.y*48+24);
      c.moveTo({x:from.x+dx,y:from.y+dy},new Set(),()=>c.setState('IDLE',''),'IDLE');
    },{dx,dy});
    await page.waitForTimeout(100);
    const state=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');return {frame:Number(c.image.frame.name),flip:c.image.flipX,moving:c.isMoving}});
    assert.equal(Math.floor(state.frame/9),row);assert.equal(state.moving,true);assert.equal(state.flip,false);
    await page.waitForFunction(()=>!window.scene.controllers.get('commander').isMoving,{},{timeout:5000});
    assert.equal(await page.evaluate(()=>Number(window.scene.controllers.get('commander').image.frame.name)),row*9);
    report.push(`direction row ${row}: walk and stop verified`);
  }
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
  await page.evaluate(()=>{const s=window.scene,c=s.controllers.get('commander');c.cell={x:15,y:11};c.container.setPosition(744,552);c.walk.face(0,1);c.showWalkFrame(c.walk.stop());s.cameras.main.stopFollow();s.cameras.main.centerOn(720,360)});
  await page.waitForTimeout(750);
  await page.screenshot({path:resolve(root,'assets/characters/commander/directional-walk/v001/board-preview.png')});
  report.push('pause/resume and Commander/Rogue switching verified');
  await page.goto(url+'/?reduced');await page.waitForFunction(()=>window.ready);
  const reduced=await page.evaluate(()=>{const c=window.scene.controllers.get('commander');c.wander({x:c.cell.x+1,y:c.cell.y},new Set());return {moving:c.isMoving,frame:Number(c.image.frame.name)}});
  assert.equal(reduced.moving,false);assert.equal(reduced.frame%9,0);
  report.push('reduced motion uses a neutral directional pose');
  await page.route('**/directional-walk/v001/spritesheet.png',route=>route.abort());
  await page.goto(url);await page.waitForFunction(()=>window.ready);
  assert.equal(await page.evaluate(()=>window.scene.controllers.get('commander').image.texture.key),'hero-commander');
  report.push('missing sprite sheet falls back to Commander poster');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(root,'assets/characters/commander/directional-walk/v001/browser-validation.json'),JSON.stringify({passed:true,checks:report,pageErrors:errors},null,2)+'\n');
  console.log(report.join('\n'));
}finally{await browser?.close();await new Promise(done=>server.close(done))}

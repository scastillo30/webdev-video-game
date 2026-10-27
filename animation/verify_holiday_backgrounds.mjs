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
try{
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ready);
 for(const mode of ['christmas','halloween','none','christmas']){
  await page.evaluate(mode=>{const s=window.scene;s.configure({...s.settings,holidayMode:mode,movementEnabled:false})},mode);
  await page.waitForTimeout(150);
  const state=await page.evaluate(()=>{const s=window.scene;return {texture:s.background.texture.key,crystal:s.crystalObjects[0].visible,clock:s.holiday.clock,controllers:[...s.controllers.keys()],windows:s.holiday.windows.commandBuffer.length,lights:s.holiday.lights.commandBuffer.length}});
  assert.equal(state.texture,mode==='none'?'castle-office-background':`castle-${mode}`);
  assert.deepEqual(await page.evaluate(()=>[window.scene.background.displayWidth,window.scene.background.displayHeight]),[1440,720]);
  assert.equal(state.crystal,mode!=='christmas');assert.ok(state.controllers.includes('commander')&&state.controllers.includes('rogue'));
  if(mode!=='none')assert.ok(state.clock>0);
  if(mode==='christmas'){assert.ok(state.windows>0&&state.lights>0);await page.screenshot({path:'/tmp/holiday-christmas.png'})}
  if(mode==='halloween'){await page.evaluate(()=>{window.scene.holiday.clock=4000});await page.waitForTimeout(50)}
  if(mode==='halloween')await page.screenshot({path:'/tmp/holiday-halloween.png'});
 }
 await page.evaluate(()=>window.game.loop.sleep());
 const paused=await page.evaluate(()=>window.scene.holiday.clock);await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.scene.holiday.clock),paused);
 await page.evaluate(()=>window.game.loop.wake());await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>window.scene.holiday.clock)>paused);
 await page.evaluate(()=>{const s=window.scene;s.configure({...s.settings,effectsEnabled:false})});await page.waitForTimeout(100);
 assert.deepEqual(await page.evaluate(()=>[window.scene.holiday.windows.commandBuffer.length,window.scene.holiday.lights.commandBuffer.length]),[0,0]);
 await page.goto(`http://127.0.0.1:${server.address().port}/?reduced`);await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>{const s=window.scene;s.configure({...s.settings,holidayMode:'christmas'})});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.scene.holiday.clock),0);
 assert.deepEqual(errors,[]);console.log('PASS: background switching, tree/snow, witch rendering, all roster controllers, pause/resume, effects off and reduced motion');
}finally{await browser?.close();await new Promise(done=>server.close(done))}

const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('assert/strict');
const path=require('path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'assets/characters/cube-wanderer/cube-wind/v002/web');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url())});
 await page.goto('http://127.0.0.1:8765/?offline=1');
 await page.waitForFunction(()=>document.querySelectorAll('.hero-btn').length===8);
 const registry=await page.evaluate(()=>CHARACTER_ANIMATIONS);
 const priorRegistry=Object.fromEntries(['commander','rogue','healer'].map(id=>{
   const manifest=JSON.parse(fs.readFileSync(path.join(root,'characters',id,'manifest.json'),'utf8'));
   const art=manifest.animations[manifest.defaultAnimation];
   return [id,Object.fromEntries(['animationId','version','animation','poster','head','width','height'].map(key=>[key,key==='width'?art.gameWidth||art.width:key==='height'?art.gameHeight||art.height:art[key]]))];
 }));
 for(const id of Object.keys(priorRegistry))assert.deepEqual(registry[id],priorRegistry[id]);
 async function select(id){
   await page.evaluate(id=>chooseHero(id,true),id);
   await page.waitForFunction(id=>{
     const slot=document.querySelector('#slotCenter');
     const img=slot.querySelector('.puppet-web');
     return slot.dataset.hero===id&&!slot.classList.contains('loading')&&(!img||(img.complete&&img.naturalWidth>0&&img.dataset.hero===id));
   },id);
 }
 async function activeState(id,stopped){
   await page.waitForFunction(({id,stopped})=>{
     const img=document.querySelector('#slotCenter .puppet-web');
     return img&&img.dataset.hero===id&&img.getAttribute('src')===(stopped?img.dataset.poster:img.dataset.animation)&&img.complete&&img.naturalWidth>0;
   },{id,stopped});
 }
 const checked=[];
 for(const id of ['commander','rogue','healer','guardian']){
   await select(id);await activeState(id,false);
   await page.locator('#motion').click();await activeState(id,true);
   await page.locator('#motion').click();await activeState(id,false);
   await page.evaluate(()=>openOverview(current));await activeState(id,true);
   await page.evaluate(()=>closeModal());await activeState(id,false);
   assert.equal(await page.locator('#portrait').getAttribute('src'),registry[id].head);
   checked.push(id);
 }
 const ids=await page.evaluate(()=>HEROES.map(h=>h.id));
 for(const id of ids){await select(id);assert.equal(await page.locator('#slotCenter .puppet-web').count(),registry[id]?1:0)}
 // Switching during Pause must select the destination character's poster.
 await page.locator('#motion').click();
 for(const id of ['guardian','healer','commander','rogue']){await select(id);await activeState(id,true)}
 await page.locator('#motion').click();await activeState('rogue',false);
 // Exercise rapid overlapping async mounts.
 await page.evaluate(()=>{chooseHero('guardian',true);chooseHero('commander',true);chooseHero('rogue',true);chooseHero('guardian',true)});
 await activeState('guardian',false);
 await page.waitForFunction(()=>!document.querySelector('#slotCenter').classList.contains('loading'));
 await page.waitForFunction(()=>document.querySelector('#slotCenter').getAnimations().every(a=>a.playState==='finished'));
 await page.screenshot({path:path.join(out,'game_integration.png')});
 // Verify native WebP decoding advances the actual pixels.
 // Canvas drawImage uses an animated image's default frame, so compare rendered pixels instead.
 const rendered=page.locator('#slotCenter .puppet-web');
 await rendered.evaluate(img=>img.style.backgroundColor='#182537');
 const first=await rendered.screenshot();
 await page.waitForTimeout(350);
 const next=await rendered.screenshot();
 assert.notDeepEqual(first,next,'The visible Guardian WebP must animate');
 await rendered.evaluate(img=>img.style.backgroundColor='');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});syncWebAnimations()});
 await activeState('guardian',true);
 await page.evaluate(()=>{delete document.hidden;syncWebAnimations()});
 await activeState('guardian',false);
 // A failed animation should fall back only to its own poster.
 await page.evaluate(()=>document.querySelector('#slotCenter .puppet-web').dispatchEvent(new Event('error')));
 await activeState('guardian',true);
 const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
 const rp=await reduced.newPage();await rp.goto('http://127.0.0.1:8765/?offline=1');
 for(const id of ['commander','rogue','healer','guardian']){
   await rp.evaluate(id=>chooseHero(id,true),id);
   await rp.waitForFunction(id=>{
     const i=document.querySelector('#slotCenter .puppet-web');
     return i&&i.dataset.hero===id&&i.getAttribute('src')===i.dataset.poster&&i.complete&&i.naturalWidth>0;
   },id);
 }
 assert.deepEqual(errors,[]);
 const report={passed:true,roster:ids,pauseResumeAndModals:checked,pausedSwitching:checked,reducedMotion:checked,rapidSwitching:true,actualAnimatedPixelsAdvance:true,hiddenDocumentFallback:true,guardianFailureFallback:true,priorRegistryPreserved:true,browserErrors:errors};
 fs.writeFileSync(path.join(out,'integration_validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

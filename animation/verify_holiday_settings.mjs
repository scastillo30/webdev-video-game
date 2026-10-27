// Full settings → API → routed Game View regression against the local development app.
import assert from 'node:assert/strict';
const {chromium}=await import('/Users/scastillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const origin=process.env.APP_URL||'http://127.0.0.1:4200';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let original;
try{
 await page.goto(`${origin}/settings/game`);
 original=await (await page.request.get(`${origin}/api/game/config`)).json();
 for(const mode of ['christmas','halloween','none']){
  await page.locator('select[name="holidayMode"]').selectOption(mode);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/game/config')&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'SAVE CONFIGURATION'}).click();
  const saved=await (await response).json();assert.equal(saved.settings.holidayMode,mode);
  await page.locator('.settings-alert.success').waitFor();
  await page.locator('nav a[href="/game"]').click();
  await page.locator('.scene-loading').waitFor({state:'detached'});
  await page.locator('canvas').waitFor();
  assert.equal(await page.getByRole('button',{name:'Focus Commander',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Focus Rogue',exact:true}).count(),1);
  await page.screenshot({path:`/tmp/settings-${mode}.png`});
  await page.reload();
  await page.locator('.scene-loading').waitFor({state:'detached'});
  await page.locator('canvas').waitFor();
  assert.equal(await page.getByRole('button',{name:'Focus Commander',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Focus Rogue',exact:true}).count(),1);
  await page.screenshot({path:`/tmp/settings-${mode}-reloaded.png`});
  await page.locator('nav a[href="/settings/game"]').click();
  await page.locator('select[name="holidayMode"]').waitFor();
  assert.equal(await page.locator('select[name="holidayMode"]').inputValue(),mode);
  console.log(`PASS ${mode}: settings save, API persistence, Game background, reload, roster`);
 }
 assert.deepEqual(errors,[]);
}catch(error){console.log('Browser errors:',errors);console.log('Page:',await page.locator('body').innerText());await page.screenshot({path:'/tmp/holiday-settings-failure.png'});throw error;}finally{
 if(original)await page.request.put(`${origin}/api/game/config`,{data:original});
 await browser.close();
}

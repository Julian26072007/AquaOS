const {launchBrowser,testUrl}=require('./browser-helpers.cjs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 const page=await browser.newPage({viewport:{width:390,height:664},timezoneId:'Europe/Vienna'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=testUrl;await page.goto(url);
 // Real UI: opening, scrubbing, playing, speed changes, Now and closing must not persist anything.
 await page.locator('#mode-auto').click();const saved=await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1'));
 for(const [width,height] of [[320,480],[375,548],[390,664],[430,760],[667,375]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),`automatic layout ${width}x${height}`);
 }
 await page.setViewportSize({width:390,height:664});const liveName=await page.locator('#preset-name').textContent();
 await page.evaluate(async()=>{
  const {LightingPass}=await import('./js/effects.js');const original=LightingPass.prototype.prepare;
  window.testCloudTimes=[];LightingPass.prototype.prepare=function(...args){window.testCloudTimes.push(args[3]);return original.apply(this,args);};
 });
 await page.locator('#preview-open').click();await page.locator('#preview-timeline').fill('450');assert.equal(await page.locator('#preview-time').textContent(),'07:30');assert.equal(await page.locator('#preview-phase').textContent(),'Sunrise');
 await page.locator('#preview-speed').selectOption('1440');await page.locator('#preview-play').click();await page.waitForTimeout(1000);await page.locator('#preview-play').click();
 const time=await page.locator('#preview-time').textContent();assert.notEqual(time,'07:30');
 const cloudSeconds=await page.evaluate(()=>Math.max(...window.testCloudTimes)-Math.min(...window.testCloudTimes));
 assert(cloudSeconds>.4&&cloudSeconds<4,'1440x schedule playback must not accelerate cloud animation');
 await page.screenshot({path:'/tmp/aquaos-day-preview.png',fullPage:true});
 for(const [minute,phase] of [[450,'sunrise'],[720,'daylight'],[1170,'sunset'],[1380,'night']]){
  await page.locator('#preview-timeline').fill(String(minute));await page.waitForTimeout(100);
  await page.locator('#preview-scene').screenshot({path:`/tmp/aquaos-cycle-${phase}.png`});
 }
 assert.equal(await page.locator('#preset-name').textContent(),liveName);assert.equal(await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1')),saved);
 await page.locator('#preview-now').click();await page.locator('#preview-close').click();assert.equal(await page.locator('#preview-dialog').evaluate(d=>d.open),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1')),saved);
 await page.reload();assert.equal(await page.locator('#mode-auto').getAttribute('aria-pressed'),'true');
 await page.locator('[data-preset=sunny]').click();assert.equal(await page.locator('#mode-manual').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#preset-name').textContent(),'Sunny');
 await page.locator('#settings-open').click();await page.locator('#sunset-start').fill('07:00');await page.locator('[type=submit]').click();assert(await page.locator('#schedule-error').textContent());
 await page.locator('#sunset-start').fill('17:30');await page.locator('[type=submit]').click();await page.waitForTimeout(50);assert.equal(await page.locator('#settings-dialog').evaluate(d=>d.open),false);
 await page.reload();await page.locator('#settings-open').click();assert.equal(await page.locator('#sunset-start').inputValue(),'17:30');
 assert.deepEqual(errors,[]);console.log('PASS: automatic layouts/settings, mode persistence, preview controls/storage isolation and independent cloud speed.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

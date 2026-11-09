const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 const url=testUrl;
 await page.goto(url);await page.waitForSelector('.preset');assert.equal(await page.locator('.preset').count(),9);
 for(const width of [320,375,390,430,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
 for(const [width,height] of [[320,480],[320,568],[375,548],[390,664],[390,844],[430,760],[667,375],[844,390]]){
  await page.setViewportSize({width,height});
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),`vertical overflow at ${width}x${height}`);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}x${height}`);
  for(const b of await page.locator('.preset').all()) {const box=await b.boundingBox();assert(box.y>=0&&box.y+box.height<=height,`preset outside ${width}x${height}`);assert(box.width>=44&&box.height>=44);}
 }
 await page.setViewportSize({width:390,height:664});
 const images=new Set();
 for(const button of await page.locator('.preset').all()){
  await button.click();await page.waitForTimeout(1600);
  assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.preset[aria-pressed=true]').count(),1);
  assert.equal(await page.locator('#preset-name').textContent(),await button.locator('.preset-name').textContent());
  images.add(await page.locator('#scene').evaluate(c=>c.toDataURL()));
  const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);
 }
 assert.equal(images.size,9,'distinct preset scenes');await page.reload();await page.waitForSelector('.preset');assert.equal(await page.locator('#preset-name').textContent(),'Sparkle');
 await page.locator('[data-preset=sunny]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#preset-name').textContent(),'Sunny');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForTimeout(1600);
 const still=await page.locator('#scene').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);
 assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),still);
 await page.locator('#manual-status').click();
 const manual=page.locator('#manual-dialog');
 assert(await manual.evaluate(d=>d.open));
 assert.equal(await manual.getByRole('slider').count(),5);
 await manual.getByLabel('Red').fill('100');
 for(const name of ['Green','Blue','Warm White','Cool White'])await manual.getByLabel(name).fill('0');
 await page.locator('#manual-apply').click();await page.waitForTimeout(1600);
 assert.equal(await page.locator('#preset-name').textContent(),'Manual channels');
 assert.equal(await page.locator('.preset[aria-pressed=true]').count(),0);
 assert.notEqual(await page.locator('#scene').evaluate(c=>c.toDataURL()),still);
 await page.reload();await page.locator('#manual-status').click();
 assert.equal(await manual.getByLabel('Red').inputValue(),'100');
 assert.equal(await manual.getByLabel('Warm White').inputValue(),'0');
 await page.keyboard.press('Escape');assert.equal(await manual.evaluate(d=>d.open),false);
 await page.locator('[data-preset=moonlight]').click();
 assert.equal(await page.locator('#preset-name').textContent(),'Moonlight');
 await page.evaluate(()=>localStorage.setItem('aquaos.settings.v1','broken'));await page.reload();await page.waitForSelector('.preset');assert.equal(await page.locator('#preset-name').textContent(),'Sunny');
 // The scenery stays stable on resize but changes on a new page load.
 const canvasImage=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
 const beforeResize=await canvasImage();
 await page.setViewportSize({width:430,height:760});await page.waitForTimeout(100);
 await page.setViewportSize({width:390,height:664});await page.waitForTimeout(100);
 assert.equal(await canvasImage(),beforeResize,'stable scenery on resize with reduced motion');
 await page.reload();await page.waitForSelector('.preset');
 assert.notEqual(await canvasImage(),beforeResize,'new scenery on refresh');
 await page.locator('#settings-open').click();
 assert(await page.locator('#settings-dialog').evaluate(d=>d.open));
 await page.keyboard.press('Escape');assert.equal(await page.locator('#settings-dialog').evaluate(d=>d.open),false);
 assert(await page.locator('#settings-open').evaluate(b=>b===document.activeElement));
 await page.locator('#settings-open').click();await page.locator('#settings-close').click();
 assert.equal(await page.locator('#settings-dialog').evaluate(d=>d.open),false);
 await page.locator('#settings-open').click();await page.mouse.click(2,2);
 assert.equal(await page.locator('#settings-dialog').evaluate(d=>d.open),false);
 await page.screenshot({path:'/tmp/aquaos-mobile.png',fullPage:true});
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}}));const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('[data-preset=clouds]').click();assert.equal(await p.locator('#preset-name').textContent(),'Clouds');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: nine distinct presets, 320–1280px, touch targets, keyboard, persistence, corrupt/blocked storage, reduced motion, project subpath, no browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});

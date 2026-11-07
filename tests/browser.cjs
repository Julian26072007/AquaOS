const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 const url=process.env.TEST_URL||'http://127.0.0.1:8000/aquaos/';
 await page.goto(url);await page.waitForSelector('.preset');assert.equal(await page.locator('.preset').count(),9);
 for(const width of [320,375,390,430,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});
 const images=new Set();
 for(const button of await page.locator('.preset').all()){
  await button.click();await page.waitForTimeout(500);
  assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[aria-pressed=true]').count(),1);
  assert.equal(await page.locator('#preset-name').textContent(),await button.locator('.preset-name').textContent());
  images.add(await page.locator('canvas').evaluate(c=>c.toDataURL()));
  const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);
 }
 assert.equal(images.size,9,'distinct preset scenes');await page.reload();await page.waitForSelector('.preset');assert.equal(await page.locator('#preset-name').textContent(),'Sparkle');
 await page.locator('[data-preset=sunny]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#preset-name').textContent(),'Sunny');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-preset=storm]').click();const still=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(600);assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),still);
 await page.locator('[data-preset=moonlight]').click();assert.notEqual(await page.locator('canvas').evaluate(c=>c.toDataURL()),still);
 await page.evaluate(()=>localStorage.setItem('aquaos.settings.v1','broken'));await page.reload();await page.waitForSelector('.preset');assert.equal(await page.locator('#preset-name').textContent(),'Sunny');
 await page.screenshot({path:'/tmp/aquaos-mobile.png',fullPage:true});
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}}));const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('[data-preset=clouds]').click();assert.equal(await p.locator('#preset-name').textContent(),'Clouds');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: nine distinct presets, 320–1280px, touch targets, keyboard, persistence, corrupt/blocked storage, reduced motion, project subpath, no browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});

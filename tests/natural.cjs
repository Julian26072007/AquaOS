const {launchBrowser,testUrl}=require('./browser-helpers.cjs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 const page=await browser.newPage({viewport:{width:390,height:740},timezoneId:'America/New_York'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=testUrl;await page.clock.setFixedTime(new Date('2026-11-09T14:00:00Z'));await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){throw new Error('GPS must not be requested');},watchPosition(){throw new Error('GPS must not be requested');}}}));await page.goto(url);
 // UI network mocked deterministically; no GPS prompts or hardware capability.
 await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hourly:{time:[Date.parse('2026-11-09T14:00:00Z')/1000-86400,Date.parse('2026-11-09T14:00:00Z')/1000+86400],cloud_cover:[50,75]},daily:{time:[]}})}));
 await page.route('https://geocoding-api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{name:'Vienna',country:'Austria',latitude:48.2082,longitude:16.3738,timezone:'Europe/Vienna'}]})}));
 await page.locator('#mode-natural').click();await page.locator('#location-search').fill('Vienna');await page.locator('#location-find').click();await page.locator('#location-results').selectOption('0');assert.equal(await page.locator('#n-timezone').inputValue(),'Europe/Vienna');
 await page.locator('#n-lat').fill('48.2082');await page.locator('#n-lon').fill('16.3738');await page.locator('#n-timezone').fill('Europe/Vienna');await page.locator('#n-location').fill('Vienna');await page.locator('[type=submit]').click();await page.waitForTimeout(300);
 assert.equal(await page.locator('#mode-natural').getAttribute('aria-pressed'),'true');
 for(const [width,height] of [[320,480],[390,664],[430,760],[667,375]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),`natural layout ${width}x${height}`);}
 await page.setViewportSize({width:390,height:740});const saved=await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1'));
 await page.locator('#preview-open').click();assert.equal(await page.locator('#weather-diagnostics').count(),0);await page.locator('#preview-timeline').fill('0');const earlyWeather=await page.locator('#preview-weather-status-api').textContent();await page.locator('#preview-timeline').fill('1439');assert.match(earlyWeather,/Forecast/);assert.match(await page.locator('#preview-weather-status-api').textContent(),/Forecast/);await page.locator('#preview-date').fill('2026-06-21');await page.locator('#preview-timeline').fill('720');await page.waitForTimeout(200);await page.screenshot({path:'/tmp/aquaos-natural-preview.png',fullPage:true});
 assert.equal(await page.locator('#preview-weather-status-api').textContent(),'API: Unavailable');assert.match(await page.locator('#preview-weather-status-applied').textContent(),/Fallback \(estimated\)/);
 await page.locator('#preview-speed').selectOption('1440');await page.locator('#preview-play').click();await page.waitForTimeout(500);await page.locator('#preview-play').click();await page.locator('#preview-now').click();const actualDate=await page.evaluate(async()=>{const {zonedParts}=await import('./js/astronomy.js');return zonedParts(Date.now(),'Europe/Vienna').date;});assert.equal(await page.locator('#preview-date').inputValue(),actualDate);await page.locator('#preview-close').click();assert.equal(await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1')),saved);
 await page.reload();assert.equal(await page.locator('#mode-natural').getAttribute('aria-pressed'),'true');await page.locator('[data-preset=sunny]').click();assert.equal(await page.locator('#mode-manual').getAttribute('aria-pressed'),'true');
 // Developer-only control retains the same comparison time and leaves live state alone.
 await page.goto(url+'?devWeather=1');await page.locator('#mode-natural').click();
 await page.locator('#preview-open').click();await page.locator('#preview-date').fill('2026-06-21');await page.locator('#preview-timeline').fill('720');
 assert.match(await page.locator('#preview-weather-status-applied').textContent(),/Fallback/);
 const stored=await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1'));
 const renderTimes=await page.evaluate(async()=>{
  const {AquariumRenderer}=await import('./js/renderer.js');const {calculateNaturalLighting}=await import('./js/natural.js');
  const {PREVIEW_WEATHER}=await import('./js/preview-weather.js');const {DEFAULT_NATURAL}=await import('./js/natural.js');const {DEFAULT_SAFETY}=await import('./js/safety.js');
  const p=calculateNaturalLighting(Date.parse('2026-06-21T12:00Z'),{...DEFAULT_NATURAL,latitude:0,longitude:0},DEFAULT_SAFETY,null,{weatherOverride:PREVIEW_WEATHER['partly-cloudy']});
  const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
  const renderer=new AquariumRenderer(canvas,p);renderer.setSuspended(true);const times=[];
  for(let i=0;i<90;i++){renderer.clock.elapsed=i/30;const start=performance.now();renderer.draw();times.push(performance.now()-start);}
  renderer.destroy();canvas.remove();times.sort((a,b)=>a-b);return {median:times[45],p95:times[85]};
 });
 assert(renderTimes.p95<33.4,'Natural global lighting rendering fits the 30fps development budget');console.log({naturalRenderMilliseconds:renderTimes});

 for(const name of ['clear','partly-cloudy','cloudy','overcast','rain','thunderstorm']){
  await page.getByLabel('Preview weather',{exact:true}).selectOption(name);
  assert.equal(await page.locator('#preview-timeline').inputValue(),'720');
  assert((await page.locator('#preview-weather').textContent()).includes('Developer simulation'));
  assert.equal(await page.locator('#preview-play').getAttribute('aria-pressed'),'false');
  await page.waitForTimeout(300);assert((await page.locator('#weather-diagnostics pre').textContent()).includes('cloud approximation'));assert.equal(await page.locator('#weather-diagnostics canvas').count(),0);assert.match(await page.locator('#weather-diagnostics pre').textContent(),/Warm White/);await page.locator('#preview-scene').screenshot({path:`/tmp/aquaos-weather-${name}.png`});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('aquaos.settings.v1')),stored);
 await page.locator('#preview-close').click();await page.locator('#preview-open').click();
 assert.equal(await page.getByLabel('Preview weather',{exact:true}).inputValue(),'');
 await page.locator('#preview-close').click();
 assert.deepEqual(errors,[]);console.log('PASS: mocked weather/location UI, Natural Mode layouts/persistence, no GPS and preview storage isolation.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

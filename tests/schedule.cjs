const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:664},timezoneId:'Europe/Vienna'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.TEST_URL||'http://127.0.0.1:8000/aquaos/';await page.goto(url);
 const result=await page.evaluate(async()=>{
  const {calculateLightingAtTime:calc,DEFAULT_SCHEDULE:s,DEFAULT_CYCLE_SETTINGS:c,validateSchedule,localMinutes}=await import('./js/schedule.js');
  const {createStore}=await import('./js/state.js');const {createRealLightingController,createPreviewController}=await import('./js/controllers.js');
  const {LightingEngine}=await import('./js/effects.js');const {LightField}=await import('./js/light-field.js');const {mapLightField}=await import('./js/hardware.js');
  const {LightingEngine:Engine}=await import('./js/effects.js');const e=new Engine();
  const dawn=e.sample(e.state(calc(450,s,c).preset,10),.5,.5),day=e.sample(e.state(calc(720,s,c).preset,10),.5,.5);
  const daylightRGBIncreases=day.red/(day.warmWhite+day.coolWhite)>dawn.red/(dawn.warmWhite+dawn.coolWhite);
  const phases=[0,359,360,450,540,1079,1080,1170,1260,1439,1440].map(t=>calc(t,s,c).phase);
  const boundaries=[360,540,1080,1260,1440].map(t=>Math.abs(calc(t-.0001,s,c).brightness-calc(t+.0001,s,c).brightness));
  const channelContinuity=[];const engine=new LightingEngine();
  for(const t of [360,540,1080,1260]){
   const a=engine.sample(engine.state(calc(t-.001,s,c).preset,10),.5,.5),b=engine.sample(engine.state(calc(t+.001,s,c).preset,10),.5,.5);
   channelContinuity.push(Math.max(...['r','g','b','red','green','blue','warmWhite','coolWhite'].map(k=>Math.abs(a[k]-b[k]))));
  }
  let invalid=0;for(const schedule of [{...s,sunsetStart:400},{...s,sunriseDuration:0},{...s,sunsetDuration:721},{...s,sunriseStart:1440}]){try{validateSchedule(schedule,c);}catch{invalid++;}}
  const overnight={sunriseStart:1380,sunriseDuration:120,sunsetStart:360,sunsetDuration:120};
  const midnightPhase=calc(30,overnight,c).phase;
  const storage={value:null,writes:0,getItem(){return this.value;},setItem(k,v){this.value=v;this.writes++;}};
  const store=createStore(storage);store.setMode('automatic');const original=JSON.stringify(store.getState()),writes=storage.writes;
  let realTime=new Date(2026,0,2,12,0,0),commands=0;const real=createRealLightingController(store,()=>realTime);
  real.subscribeRealOutput(()=>commands++);const before=real.sample();
  const preview=createPreviewController(store.getState().schedule,store.getState().cycleSettings,0);
  preview.scrub(450);preview.setPlaying(true);const speeds=[];
  for(const speed of [60,360,1440]){preview.scrub(0);preview.setSpeed(speed);preview.advance(1);speeds.push(preview.snapshot().minutes);}
  preview.scrub(1439);preview.advance(1);const loop=preview.snapshot().minutes;preview.setPlaying(false);preview.advance(600);const paused=preview.snapshot().minutes;
  const realUntouched=real.getOutput()===before&&real.getOutput().at===realTime.getTime()&&commands===1;
  const stateUntouched=JSON.stringify(store.getState())===original&&storage.writes===writes;
  realTime=new Date(2026,0,2,22,0,0);const actual=real.sample();
  store.selectPreset('waves');const manual=real.sample();const scheduleUnchanged=JSON.stringify(store.getState().schedule)===JSON.stringify(s);
  store.setMode('automatic');const restored=createStore(storage);
  const field=new LightField();field.update(engine,engine.state(calc(0,s,c).preset,10));const night=mapLightField(field);
  const moon=calc(0,s,{...c,moonlightEnabled:true,moonlightIntensity:.02});
  return {daylightRGBIncreases,phases,boundaries,channelContinuity,invalid,midnightPhase,speeds,loop,paused,realUntouched,stateUntouched,actualPhase:actual.cycle.phase,manualId:manual.preset.id,scheduleUnchanged,restoredMode:restored.getState().mode,night,moonBrightness:moon.brightness,localMinutes:localMinutes(new Date(2026,0,1,6,30))};
 });
 assert(result.daylightRGBIncreases);
 assert.deepEqual(result.phases,['Night','Night','Sunrise','Sunrise','Daylight','Daylight','Sunset','Sunset','Night','Night','Night']);
 assert(result.boundaries.every(v=>v<.00001));assert(result.channelContinuity.every(v=>v<.0001));assert.equal(result.invalid,4);assert.equal(result.midnightPhase,'Sunrise');
 assert.deepEqual(result.speeds,[1,6,24]);assert.equal(result.loop,23);assert.equal(result.paused,23);assert(result.realUntouched);assert(result.stateUntouched);assert.equal(result.actualPhase,'Night');assert.equal(result.manualId,'waves');assert(result.scheduleUnchanged);assert.equal(result.restoredMode,'automatic');assert.equal(result.localMinutes,390);assert.equal(result.moonBrightness,.02);
 for(const assembly of result.night)for(const values of Object.values(assembly.channels))assert(values.every(v=>v===0),'night commands must be off');
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
 assert.deepEqual(errors,[]);console.log('PASS: local/cross-midnight schedules, smooth channel boundaries, validation, night off, moonlight, persistence, clock/output/storage separation, preview speeds/loop/pause, manual mode, automatic phone layouts and settings UI.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

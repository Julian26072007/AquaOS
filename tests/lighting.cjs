const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:664},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8000/aquaos/');
 const result=await page.evaluate(async()=>{
  const {LightingEngine}=await import('./js/effects.js');
  const {getPreset}=await import('./js/presets.js');
  const {AnimationClock}=await import('./js/timing.js');
  const engine=new LightingEngine();
  const clouds=getPreset('clouds'),sunny=getPreset('sunny'),storm=getPreset('storm');
  const luma=s=>(s.r+s.g+s.b)/3;
  const samples=t=>Array.from({length:120},(_,i)=>engine.sample(engine.state(clouds,t),(i%15)/14,Math.floor(i/15)/7));
  const a=samples(0),b=samples(30),near=samples(1/30);
  const spatial=Math.max(...a.map(luma))-Math.min(...a.map(luma));
  const temporal=a.reduce((sum,v,i)=>sum+Math.abs(luma(v)-luma(b[i])),0)/a.length;
  const frameDelta=Math.max(...a.map((v,i)=>Math.abs(luma(v)-luma(near[i]))));
  const sunnyRange=Array.from({length:20},(_,i)=>luma(engine.sample(engine.state(sunny,0),i/19,.4)));
  const sunnySpatial=Math.max(...sunnyRange)-Math.min(...sunnyRange);
  let causticPeak=0,blockedCaustic=0,openCaustic=0;
  for(let i=0;i<300;i++)causticPeak=Math.max(causticPeak,engine.sample(engine.state(getPreset('waves'),12),(i%30)/29,Math.floor(i/30)/9).caustic);
  for(let i=0;i<300;i++){
    const x=(i%30)/29,y=Math.floor(i/30)/9;
    const open=engine.sample(engine.state({...clouds,cloudDensity:0},30),x,y);
    const blocked=engine.sample(engine.state(clouds,30),x,y);
    if(open.caustic-blocked.caustic>openCaustic-blockedCaustic){openCaustic=open.caustic;blockedCaustic=blocked.caustic;}
  }
  const reducedFlash=engine.state(storm,10,true).flash;
  let flashCount=0,flashTimes=[],lastFlash=-2,minLuma=1,cloudMaxDelta=0;
  for(let t=0;t<120;t+=.025){
   const state=engine.state(storm,t);
   if(state.flash>0&&t-lastFlash>.5){flashCount++;flashTimes.push(t);}if(state.flash>0)lastFlash=t;
  }
  for(let t=0;t<180;t+=.2){
   const s=engine.sample(engine.state(clouds,t),.4,.5),next=engine.sample(engine.state(clouds,t+.2),.4,.5);
   minLuma=Math.min(minLuma,luma(s));cloudMaxDelta=Math.max(cloudMaxDelta,Math.abs(luma(s)-luma(next)));
  }
  const clock=new AnimationClock();clock.advance(1000);clock.advance(2000);clock.advance(7000);
  const elapsed=clock.elapsed;clock.reset();clock.advance(100000);const resumed=clock.elapsed;
  const rise0=engine.state(getPreset('sunrise'),0).direct,rise90=engine.state(getPreset('sunrise'),90).direct;
  const set0=engine.state(getPreset('sunset'),0).direct,set90=engine.state(getPreset('sunset'),90).direct;
  // Deterministic scene for time-separated screenshot comparison.
  const {AquariumRenderer}=await import('./js/renderer.js');
  const {createScenery}=await import('./js/scenery.js');
  const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
  const renderer=new AquariumRenderer(canvas,clouds);renderer.destroy();renderer.motion={matches:false};renderer.transition=1;
  let seed=42;renderer.scenery=createScenery(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  window.lightingFixture={renderer,canvas,getPreset};
  return {spatial,temporal,frameDelta,sunnySpatial,causticPeak,blockedCaustic,openCaustic,reducedFlash,flashCount,flashTimes,minLuma,cloudMaxDelta,elapsed,resumed,rise0,rise90,set0,set90};
 });
 assert(result.spatial>.15,'clouds have spatially varying illumination');
 assert(result.temporal>.035,'cloud shadows visibly travel over 30 seconds');
 assert(result.frameDelta<.01,'no per-frame illumination jumps');
 assert(result.sunnySpatial<.06,'sunny remains stable across tank');
 assert(result.minLuma>.25,'ambient keeps shaded scene visible');
 assert(result.cloudMaxDelta<.04,'continuous light over three minutes');
 assert(result.flashCount>=3&&result.flashCount<=15,'occasional lightning');
 assert(result.causticPeak>.02,'visible natural wave highlights');assert(result.openCaustic-result.blockedCaustic>.001,'caustics attenuate under clouds');
 assert.equal(result.reducedFlash,0);assert.equal(result.elapsed,6);assert.equal(result.resumed,6);
 assert(result.rise90>result.rise0);assert(result.set90<result.set0);
 for(const t of [0,15,30,60]){
  await page.evaluate(t=>{const {renderer}=window.lightingFixture;renderer.clock.elapsed=t;renderer.draw();},t);
  await page.locator('canvas').last().screenshot({path:`/tmp/aquaos-clouds-${t}.png`});
 }
 for(const id of ['sunny','storm','moonlight','waves']){
  await page.evaluate(id=>{const {renderer,getPreset}=window.lightingFixture;renderer.preset=getPreset(id);renderer.previous=renderer.preset;renderer.draw();},id);
  await page.locator('canvas').last().screenshot({path:`/tmp/aquaos-${id}.png`});
 }
 await page.evaluate(t=>{const {renderer,getPreset}=window.lightingFixture;renderer.preset=getPreset('storm');renderer.previous=renderer.preset;renderer.clock.elapsed=t;renderer.draw();},result.flashTimes[0]+.05);
 await page.locator('canvas').last().screenshot({path:'/tmp/aquaos-storm-flash.png'});
 const performance=await page.evaluate(()=>{
  const {renderer,getPreset}=window.lightingFixture;renderer.preset=getPreset('clouds');renderer.previous=renderer.preset;
  const samples=[];for(let i=0;i<90;i++){renderer.clock.elapsed=i/30;const start=performance.now();renderer.draw();samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);return {median:samples[45],p95:samples[85],max:samples[89]};
 });
 assert(performance.p95<33.4,'rendering fits 30fps desktop budget');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks:result,renderMilliseconds:performance},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

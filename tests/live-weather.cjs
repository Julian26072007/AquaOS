const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce'});
  await page.goto(testUrl);
  const result=await page.evaluate(async()=>{
   const {AquariumRenderer}=await import('./js/renderer.js');
   const {createScenery}=await import('./js/scenery.js');
   const {createRealLightingController,createPreviewController}=await import('./js/controllers.js');
   const {normalizeForecast}=await import('./js/weather.js');
   const {DEFAULT_NATURAL}=await import('./js/natural.js');
   const {DEFAULT_SAFETY}=await import('./js/safety.js');
   const {DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS}=await import('./js/schedule.js');
   const at=Date.parse('2026-06-21T12:00Z'),n={...DEFAULT_NATURAL,latitude:0,longitude:0};
   const make=cloud=>normalizeForecast({hourly:{time:[at/1000-10800,at/1000+10800],cloud_cover:[cloud,cloud],wind_speed_10m:[4,4],wind_direction_10m:[90,90]}},n,at);
   let state={mode:'natural',natural:n,safety:DEFAULT_SAFETY,schedule:DEFAULT_SCHEDULE,cycleSettings:DEFAULT_CYCLE_SETTINGS};
   let now=at-2400000,data=make(20);
   const real=createRealLightingController({getState:()=>state},()=>new Date(now),()=>({data,status:'fresh'}));
   real.sample();for(let i=0;i<480;i++){now+=5000;real.sample();}
   const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
   // Keep all samples on the same Canvas backend across repeated readbacks.
   canvas.getContext('2d',{willReadFrequently:true});
   const renderer=new AquariumRenderer(canvas,real.getOutput());renderer.setSuspended(true);
   let seed=42;renderer.scenery=createScenery(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
   const draw=p=>{renderer.setLighting(p);renderer.draw();return new Uint8ClampedArray(renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data);};
   const diff=(a,b)=>{let sum=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d);}return {mean:sum/a.length,max};};
   const initial=draw(real.sample()),repeated=diff(initial,draw(real.sample()));
   data=structuredClone(data);data.fetchedAt=now;
   const identical=diff(initial,draw(real.sample()));
   data=make(90);const acquired=draw(real.sample()),changed=diff(initial,acquired);
   now+=16;const nextFrame=diff(acquired,draw(real.sample()));
   now+=30000;const midway=draw(real.sample());
   data={...structuredClone(data),fetchedAt:now};
   const midRefresh=diff(midway,draw(real.sample()));
   now=at+60000;const settled=draw(real.sample()),response=diff(acquired,settled);
   data=null;const missing=diff(settled,draw(real.sample()));
   data=make(50);const returning=diff(settled,draw(real.sample()));
   const preview=createPreviewController(DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,720,{natural:n,safety:DEFAULT_SAFETY,data,date:'2026-06-21',now:at});
   const previewInitial=draw(preview.snapshot());
   preview.setPlaying(true);preview.advance(5);preview.scrub(720);
   const scrub=diff(previewInitial,draw(preview.snapshot()));
   const beforeSwitch=draw(real.sample());
   let switchDelta=0;
   for(let i=0;i<5;i++){
    state={...state,mode:'automatic'};switchDelta=Math.max(switchDelta,diff(beforeSwitch,draw(real.sample())).max);
    state={...state,mode:'natural'};switchDelta=Math.max(switchDelta,diff(beforeSwitch,draw(real.sample())).max);
   }
   const stableSwitch=diff(draw(real.sample()),draw(real.sample()));
   renderer.destroy();return {repeated,identical,changed,nextFrame,midRefresh,response,missing,returning,scrub,stableSwitch,switchDelta};
  });
  for(const key of ['repeated','identical','changed','midRefresh','missing','returning','scrub','stableSwitch']){
   assert(result[key].mean<.01,`${key}: ${JSON.stringify(result[key])}`);assert(result[key].max<=1);
  }
  assert(result.switchDelta<=1);assert(result.nextFrame.mean<.05);assert(result.response.mean>.1);
  console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

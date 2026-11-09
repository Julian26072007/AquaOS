const test = require('node:test');
const assert = require('node:assert/strict');

// Existing domain regressions run directly against the same ES modules as the browser.
test('natural domain regressions', async () => {
 const result=await (async()=>{
  const {DEFAULT_NATURAL:N,calculateNaturalLighting:calc,naturalPlan,validateNatural}=await import('../../js/natural.js');
  const {DEFAULT_SAFETY:S,limitRealChange,createNaturalRuntimeSafety}=await import('../../js/safety.js');
  const {astronomyAt,epochForZoned:epoch,zonedParts}=await import('../../js/astronomy.js');
  const {weatherAt,normalizeForecast,createWeatherProvider,forecastUrl,locationKey,MAX_WEATHER_AGE}=await import('../../js/weather.js');
  const {createStore}=await import('../../js/state.js');const {createRealLightingController,createPreviewController}=await import('../../js/controllers.js');
  const n={...N,latitude:48.2082,longitude:16.3738,timezone:'Europe/Vienna',locationName:'Vienna'},s={...S};
  let rejectedSettings=0;
  for(const [config,policy] of [[{...n,timezone:'Fake/Zone'},s],[{...n,latitude:999},s],[n,{...s,maxBrightness:2}],[n,{...s,minDarkHours:0}]]){try{validateNatural(config,policy);}catch{rejectedSettings++;}}
  const seasons=[];
  for(const date of ['2026-03-29','2026-06-21','2026-10-25','2026-12-21']){
   const p=naturalPlan(date,n,s),next=naturalPlan(new Date(Date.parse(date+'T12:00Z')+86400000).toISOString().slice(0,10),n,s);
   let active=0,max=0;
   for(let minute=0;minute<1440;minute+=5){const r=calc(epoch(date,minute,n.timezone),n,s);if(r.brightness>0)active+=5;max=Math.max(max,r.brightness);if(!Number.isFinite(r.brightness))throw new Error('Nonfinite natural output');}
   seasons.push({date,total:p.total,active,max,darkGap:(next.start-p.end)/3600000,sunrise:p.sun.sunrise,sunset:p.sun.sunset});
  }
  const polar=naturalPlan('2026-06-21',{...n,latitude:78.2,longitude:15.6,timezone:'Arctic/Longyearbyen'},s);
  const noon=epoch('2026-06-21',720,n.timezone),plan=naturalPlan('2026-06-21',n,s);
  const makeData=(cloud,rain=0,phase=.5)=>({schema:1,key:locationKey(n),fetchedAt:noon,hourly:[{at:noon-86400000,cloud,rain,precipitation:rain,low:cloud,mid:cloud,high:cloud,code:rain?95:0,windSpeed:4,windDirection:359,radiation:rain?50:700},{at:noon+86400000,cloud,rain,precipitation:rain,low:cloud,mid:cloud,high:cloud,code:rain?95:0,windSpeed:4,windDirection:1,radiation:rain?50:700}],daily:[{date:'2026-06-21',moonPhase:phase}]});
  const clear=calc(noon,n,s,makeData(0),{now:noon}),storm=calc(noon,n,s,makeData(100,8),{now:noon});
  const bad=calc(noon,n,s,{schema:1,fetchedAt:noon,hourly:[{at:noon-1000,cloud:'bad'},{at:noon+1000,cloud:NaN}],daily:[]},{now:noon});
  const old=weatherAt(noon,makeData(0),noon+MAX_WEATHER_AGE+1);
  const interp=weatherAt(noon,makeData(50),noon);
  const moonFull=astronomyAt(noon,n,makeData(0,0,.5)),moonNew=astronomyAt(noon,n,makeData(0,0,0));
  const moonN={...n,moonEnabled:true,moonCap:1/1000,offsetMinutes:360},moonPlans=naturalPlan('2026-06-21',moonN,s);
  let moonAbove=0,moonBelow=0,moonPeak=0,moonPeakAt=null;
  for(let day=1;day<=30;day++){
   const date=`2026-06-${String(day).padStart(2,'0')}`,p=naturalPlan(date,moonN,s);
   for(let m=5;m<p.moon;m+=10){const t=p.dayEnd+m*60000,r=calc(t,moonN,s);if(r.astronomy.moonAbove){moonAbove++;if(r.brightness>moonPeak){moonPeak=r.brightness;moonPeakAt=t;}}else if(r.brightness===0)moonBelow++;}
  }
  let fullOutput=0,newOutput=0;
  if(moonPeakAt!==null){
    const date=zonedParts(moonPeakAt,n.timezone).date;
    const moonData=phase=>({...makeData(0,0,phase),fetchedAt:moonPeakAt,hourly:makeData(0).hourly.map((r,i)=>({...r,at:moonPeakAt+(i?1:-1)*86400000})),daily:[{date,moonPhase:phase}]});
    fullOutput=calc(moonPeakAt,moonN,s,moonData(.5),{now:moonPeakAt}).brightness;
    newOutput=calc(moonPeakAt,moonN,s,moonData(0),{now:moonPeakAt}).brightness;
  }
  assert(clear.channels.coolWhite>storm.channels.coolWhite);
  const twilightN={...n,twilightMinutes:15},twilightPlan=naturalPlan('2026-06-21',twilightN,s),twilight=calc(twilightPlan.start+8*60000,twilightN,s);
  const limit=limitRealChange(clear,{brightness:0},1,s),dark=limitRealChange(calc(plan.end+3600000,n,s),{brightness:.8},1,s);
  const runtime=createNaturalRuntimeSafety();
  let r=runtime(clear,null,0,n,s);r=runtime(clear,r,1000,n,s);r=runtime({...clear,phase:'Night',brightness:0,darknessRequired:true},r,2000,n,s);const blocked=runtime(clear,r,3000,n,s);
  const resumed=runtime(clear,blocked,2000+s.minDarkHours*3600000+1,n,s);
  const budgetRuntime=createNaturalRuntimeSafety();let br=budgetRuntime(clear,null,0,n,s);br=budgetRuntime(clear,br,1000,n,s);const exhausted=budgetRuntime(clear,br,9*3600000+2000,n,s);
  const protectedDarkness=blocked.brightness===0&&blocked.policyReason==='Protected darkness'&&resumed.brightness>0;
  const episodeBudget=exhausted.brightness===0&&exhausted.policyReason==='Light budget reached';
  const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};const store=createStore(storage);
  store.saveConfiguration(store.getState().schedule,store.getState().cycleSettings,n,s);store.setMode('natural');let clock=noon,commands=0;
  const real=createRealLightingController(store,()=>new Date(clock),()=>({data:makeData(50),status:'fresh'}));real.subscribeRealOutput(()=>commands++);real.sample();clock+=1000;const before=real.sample();
  const saved=storage.value,preview=createPreviewController(store.getState().schedule,store.getState().cycleSettings,720,{natural:n,safety:s,date:'2026-06-21',now:noon,data:makeData(50)});
  preview.scrub(0);preview.setPlaying(true);preview.setSpeed(1440);preview.advance(5);preview.setDate('2026-12-21');const ps=preview.snapshot();
  const {buildDevicePlan}=await import('../../js/device-plan.js');
  const devicePlan=buildDevicePlan(before,n,s);let rejectedPreview=false;try{buildDevicePlan(ps,n,s);}catch{rejectedPreview=true;}
  const isolated=commands===2&&real.getOutput()===before&&storage.value===saved;
  // Mock provider: full success, TTL reuse, offline cache, lunar-field retry.
  const cache=new Map(),st={getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)};let calls=0;
  const raw={hourly:{time:[noon/1000-3600,noon/1000+3600],cloud_cover:[0,100]},daily:{time:[noon/1000],sunrise:[null],sunset:[null],moon_phase:[.5]}};
  const provider=createWeatherProvider({storage:st,now:()=>noon,fetcher:async()=>{calls++;return {ok:true,json:async()=>raw};}});
  await provider.refresh(n);await provider.refresh(n);const fresh=provider.snapshot();
  const offline=createWeatherProvider({storage:st,now:()=>noon+60000,fetcher:async()=>{throw Error('offline')}});await offline.refresh(n,{force:true});
  let attempts=0;const retry=createWeatherProvider({now:()=>noon,fetcher:async()=>{attempts++;return attempts===1?{ok:false,status:400}:{ok:true,json:async()=>raw};}});await retry.refresh(n);
  const missing=createWeatherProvider({now:()=>noon,fetcher:async()=>({ok:true,json:async()=>({})})});await missing.refresh(n);
  let resolvesOld;
  const secondLocation={...n,latitude:51.5,longitude:-.1,timezone:'Europe/London'};
  const race=createWeatherProvider({now:()=>noon,fetcher:async url=>{
    if(new URL(url).searchParams.get('latitude')==='48.2082')return new Promise(resolve=>{resolvesOld=resolve;});
    return {ok:true,json:async()=>raw};
  }});
  const pending=race.refresh(n);await race.refresh(secondLocation);resolvesOld({ok:true,json:async()=>raw});await pending;
  const raceKey=race.snapshot().data.key;
  const interpolatedCloud=weatherAt(noon,normalizeForecast(raw,n,noon),noon).cloud;
  const {prepareRealHardwareOutput}=await import('../../js/hardware-output.js');
  const guarded0=prepareRealHardwareOutput(before,s),guarded1=prepareRealHardwareOutput({...before,at:before.at+1000},s,undefined,guarded0);
  let rejectedPreviewField=false;try{prepareRealHardwareOutput(ps,s);}catch{rejectedPreviewField=true;}
  const guardedMax=Math.max(...Object.values(guarded1.channels));
  const dst={spring:zonedParts(epoch('2026-03-29',150,n.timezone),n.timezone).minutes,autumn:zonedParts(epoch('2026-10-25',150,n.timezone),n.timezone).minutes};
  const beforeMid=calc(epoch('2026-06-21',1439.99,n.timezone),n,s),afterMid=calc(epoch('2026-06-22',.01,n.timezone),n,s);
  const targetSamples=[];for(let i=0;i<10;i++)targetSamples.push(calc(plan.start+i*.1*60000,n,s).brightness);
  return {afterMidnightSky:afterMid.nextAstronomy.label,protectedDarkness,episodeBudget,rejectedSettings,rejectedPreviewField,guardedMax,interpolatedCloud,devicePlan,rejectedPreview,raceKey,secondKey:locationKey(secondLocation),n,s,seasons,polarTotal:polar.total,clear:clear.brightness,storm:storm.brightness,bad:bad.brightness,oldSource:old.source,wind:interp.windDirection,full:moonFull.moonFraction,newMoon:moonNew.moonFraction,moonAbove,moonBelow,moonPeak,fullOutput,newOutput,moonTotal:moonPlans.total,twilightPhase:twilight.phase,twilightLevel:twilight.brightness,slew:limit.brightness,dark:dark.brightness,isolated,psSource:ps.source,providerCalls:calls,providerStatus:fresh.status,offlineStatus:offline.snapshot().status,offlineCached:!!offline.snapshot().data,retry:attempts,missingStatus:missing.snapshot().status,dst,midnightJump:Math.abs(beforeMid.brightness-afterMid.brightness),url:forecastUrl(n)};
 })();
 for(const row of result.seasons){assert(row.total<=540);assert(row.active<=540);assert(row.max<=.8);assert(row.darkGap>=12-1e-6);assert(Number.isFinite(row.sunrise));assert(Number.isFinite(row.sunset));}
 assert.equal(result.afterMidnightSky,'Sunrise');
 assert(result.protectedDarkness);assert(result.episodeBudget);
 assert.equal(result.rejectedSettings,4);
 assert(result.rejectedPreviewField);assert(result.guardedMax<=.02/60+1e-9);
 assert.equal(result.interpolatedCloud,50);
 assert(result.rejectedPreview);assert.equal(result.devicePlan.lightning,false);assert.equal(result.devicePlan.onExpiry,'off');assert.equal(result.raceKey,result.secondKey);
 assert(result.polarTotal<=540);assert(result.storm>=result.clear*.75-1e-6);assert(result.storm<result.clear);assert(Number.isFinite(result.bad));assert.equal(result.oldSource,'estimated');assert(result.wind<2||result.wind>358);assert(result.full>.99);assert(result.newMoon<.001);assert(result.moonBelow>0);assert(result.moonAbove>0);assert(result.moonPeak>0&&result.moonPeak<=.001);assert(result.fullOutput>0);assert.equal(result.newOutput,0);assert(result.moonTotal<=540);assert.equal(result.twilightPhase,'Twilight');assert(result.twilightLevel>0&&result.twilightLevel<=.003);assert(result.slew<=.02/60+1e-9);assert.equal(result.dark,0);assert(result.isolated);assert.equal(result.psSource,'preview');assert.equal(result.providerCalls,1);assert.equal(result.providerStatus,'fresh');assert.equal(result.offlineStatus,'offline');assert(result.offlineCached);assert.equal(result.retry,2);assert.equal(result.missingStatus,'offline');assert.equal(result.dst.spring,210);assert.equal(result.dst.autumn,150);assert(result.midnightJump<.001);
 console.log(JSON.stringify({seasonWindows:result.seasons.map(s=>({date:s.date,hours:s.total/60,darkHours:s.darkGap})),stormRatio:result.storm/result.clear,fullMoon:result.fullOutput,newMoon:result.newOutput,perChannelStep:result.guardedMax,dst:result.dst,previewRejected:result.rejectedPreview&&result.rejectedPreviewField},null,2));

});

const test=require('node:test'),assert=require('node:assert/strict');
test('live acquisition preserves final lighting, then follows changed weather without procedural resets',async()=>{
 const {createLiveEnvironmentEvaluator}=await import('../../js/live-environment.js');
 const {evaluateEnvironment}=await import('../../js/environment.js');
 const {normalizeForecast}=await import('../../js/weather.js');
 const {DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY:s}=await import('../../js/safety.js');
 const n={...DEFAULT_NATURAL,latitude:0,longitude:0},at=Date.parse('2026-06-21T12:00Z');
 const data=cloud=>normalizeForecast({hourly:{time:[at/1000-3600,at/1000,at/1000+3600],cloud_cover:[cloud,cloud,cloud],wind_speed_10m:[4,4,4],wind_direction_10m:[90,90,90]},current:{time:at/1000,cloud_cover:cloud}},n,at);
 const sample=cycle=>cycle.channels;
 const live=createLiveEnvironmentEvaluator(),old=data(20),fresh=data(90);
 const before=live(at,n,s,old),changed=live(at,n,s,fresh);
 const difference=(a,b)=>Math.max(...Object.keys(a).map(key=>Math.abs(a[key]-b[key])));
 assert(difference(sample(before),sample(changed))<1e-12);
 for(let i=0;i<10;i++)assert.deepEqual(live(at,n,s,fresh),changed);
 // Identical refreshes, including recreated inputs, cannot restart a transition.
 const midway=live(at+30000,n,s,fresh);
 const identical={...structuredClone(fresh),fetchedAt:at+30000};
 assert.deepEqual(sample(live(at+30000,n,s,identical)),sample(midway));
 assert(difference(sample(live(at+60000,n,s,identical)),sample(evaluateEnvironment(at+60000,n,s,fresh,{current:true})))<1e-10);
 assert(difference(sample(midway),sample(changed))>.001);
 // Interrupted acquisition remains continuous at the update instant.
 const interrupted=live(at+60000,n,s,old),interruptedAgain=live(at+60000,n,s,data(50));
 assert(difference(sample(interrupted),sample(interruptedAgain))<1e-12);
 // Missing data and return preserve applied channels.
 const missing=live(at+60000,n,s,null);
 assert(difference(sample(interruptedAgain),sample(missing))<1e-12);
 const restored=live(at+60000,n,s,fresh);
 assert(difference(sample(missing),sample(restored))<1e-12);
 const sparse=data(50);for(const row of sparse.hourly){row.cloud=null;row.windDirection=null;}
 const gap=live(at+60000,n,s,sparse);assert(difference(sample(restored),sample(gap))<1e-12);
 for(const v of Object.values(sample(live(at+120000,n,s,sparse))))assert(Number.isFinite(v)&&v>=0&&v<=1);
 // Render count cannot change the absolute-time acquisition transition.
 const frequent=createLiveEnvironmentEvaluator(),sparseSampling=createLiveEnvironmentEvaluator();
 for(const evaluator of [frequent,sparseSampling]){evaluator(at,n,s,old);evaluator(at,n,s,fresh);}
 for(let ms=0;ms<30000;ms+=250)frequent(at+ms,n,s,fresh);
 assert.deepEqual(frequent(at+30000,n,s,fresh),sparseSampling(at+30000,n,s,fresh));
 // Forecast expiry must retain the last applied channels.
 const expiry=createLiveEnvironmentEvaluator();expiry(at+3600000,n,s,old);
 const last=sample(expiry(at+3600000,n,s,old));
 assert(difference(last,sample(expiry(at+3600001,n,s,old)))<.00001);
 // Unchanged weather and current-observation expiry are naturally continuous.
 const steady=createLiveEnvironmentEvaluator();steady(at,n,s,old);
 const a=sample(steady(at+1800000-1,n,s,old)),b=sample(steady(at+1800000+1,n,s,old));
 assert(difference(a,b)<.001);
});

test('a changed forecast near dusk fades to zero within the astronomical window',async()=>{
 const {createLiveEnvironmentEvaluator}=await import('../../js/live-environment.js');
 const {naturalPlan,DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY:policy}=await import('../../js/safety.js');
 const {OFF}=await import('../../js/lighting.js');
 const natural={...DEFAULT_NATURAL,latitude:0,longitude:0};
 const {dayEnd}=naturalPlan('2026-06-21',natural,policy),at=dayEnd-20000;
 const forecast=cloud=>({fetchedAt:at,hourly:[{at:at-3600000,cloud},{at:at+3600000,cloud}]});
 const live=createLiveEnvironmentEvaluator(),clear=forecast(0),overcast=forecast(100);
 const before=live(at,natural,policy,clear);
 assert.deepEqual(live(at,natural,policy,overcast).channels,before.channels);
 const dusk=live(dayEnd-5,natural,policy,overcast);
 assert(Object.values(dusk.channels).every(level=>level<.000001));
 assert.deepEqual(live(dayEnd,natural,policy,overcast).channels,OFF);
});

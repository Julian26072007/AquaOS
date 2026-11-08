const test=require('node:test'),assert=require('node:assert/strict');
test('continuous weather reaches actual renderer channels with independent phenomena',async()=>{
 const {evaluateEnvironment}=await import('../../js/environment.js');
 const {DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const {LightingEngine}=await import('../../js/effects.js');
 const n={...DEFAULT_NATURAL,latitude:0,longitude:0},at=Date.parse('2026-06-21T12:00Z');
 const base={source:'simulation',rain:0,precipitation:0,snowfall:0,windSpeed:4,windDirection:240};
 const conditions={clear:{cloud:0},partly:{cloud:45},overcast:{cloud:100},sunRain:{cloud:35,rain:3,directRadiation:500,diffuseRadiation:100},heavy:{cloud:95,rain:10},sunSnow:{cloud:35,snowfall:1,directRadiation:500,diffuseRadiation:100}};
 const values={};
 for(const [name,weather] of Object.entries(conditions)){
  const input={...base,...weather};
  const cycle=evaluateEnvironment(at,n,DEFAULT_SAFETY,null,{weatherOverride:input});
  assert.deepEqual(cycle,evaluateEnvironment(at,n,DEFAULT_SAFETY,null,{weatherOverride:input}));
  const engine=new LightingEngine(7319),sample=epoch=>{
   const c=evaluateEnvironment(epoch,n,DEFAULT_SAFETY,null,{weatherOverride:input});
   const state=engine.state(c.preset,999);
   return Array.from({length:200},(_,i)=>engine.sample(state,(i%20)/19,Math.floor(i/20)/9));
  };
  const a=sample(at),b=sample(at+600000),near=sample(at+10);
  const luma=v=>(v.r+v.g+v.b)/3,ls=a.map(luma);
  for(const v of a)for(const key of ['r','g','b','transmission','cloudOpening'])assert(Number.isFinite(v[key])&&v[key]>=0&&v[key]<=1);
  const e=cycle.environment;
  for(const key of ['cloudCoverage','cloudOpacity','rainIntensity','snowIntensity','haze','variability','directSolarIllumination','diffuseSkyIllumination'])assert(e[key]>=0&&e[key]<=1,key);
  values[name]={mean:ls.reduce((s,v)=>s+v,0)/ls.length,range:Math.max(...ls)-Math.min(...ls),change:a.reduce((s,v,i)=>s+Math.abs(luma(v)-luma(b[i])),0)/a.length};
  assert(Math.max(...a.map((v,i)=>Math.abs(luma(v)-luma(near[i]))))<.001);
  assert.deepEqual(engine.sample(engine.state(cycle.preset,1),.3,.7),engine.sample(engine.state(cycle.preset,10000),.3,.7));
  assert.equal(engine.state(cycle.preset,0).flash,0);
  if(name==='sunRain')assert(e.rainIntensity>0&&e.directSolarIllumination>0);
  if(name==='sunSnow')assert(e.snowIntensity>0&&e.directSolarIllumination>0);
 }
 assert(values.clear.mean>values.overcast.mean);
 assert(values.partly.range>values.overcast.range);
 assert(values.partly.change>.001);
 console.log(values);
});
test('wind integral is continuous through forecast boundaries and independent of evaluation order',async()=>{
 const {continuousWeather,cloudDisplacement}=await import('../../js/weather-environment.js');
 const at=Date.parse('2026-12-31T23:00Z'),w={cloud:50,rain:2,windSpeed:2,windDirection:359};
 const data={hourly:[{at,...w},{at:at+3600000,...w,windSpeed:20,windDirection:90},{at:at+7200000,...w,windDirection:180}]};
 const end=at+3600000,a=cloudDisplacement(end-1,data,w),b=cloudDisplacement(end+1,data,w);
 assert(Math.hypot(a.x-b.x,a.y-b.y)<.00001);
 const first=continuousWeather(end,w,data);continuousWeather(end+864000000,w,data);
 assert.deepEqual(first,continuousWeather(end,w,data));
 const slow=cloudDisplacement(end,{hourly:data.hourly.map(r=>({...r,windSpeed:1,windDirection:90}))},w);
 const fast=cloudDisplacement(end,{hourly:data.hourly.map(r=>({...r,windSpeed:30,windDirection:90}))},w);
 const start=cloudDisplacement(at,data,w);
 assert(Math.abs(fast.x-start.x)>Math.abs(slow.x-start.x)*2);
 const south=cloudDisplacement(end,{hourly:data.hourly.map(r=>({...r,windSpeed:30,windDirection:0}))},w);
 assert(Math.abs(south.y-start.y)>Math.abs(south.x-start.x));
});
test('snow and visibility parsing preserves unavailable values and units',async()=>{
 const {normalizeForecast,weatherAt,forecastUrl}=await import('../../js/weather.js');
 const at=Date.parse('2026-06-21T12:00Z'),n={latitude:0,longitude:0,timezone:'UTC'};
 const data=normalizeForecast({hourly:{time:[at/1000,at/1000+3600],snowfall:[0,2],visibility:[20000,2000]}},n,at);
 const w=weatherAt(at+1800000,data,at);assert.equal(w.snowfall,1);assert.equal(w.visibility,11000);
 assert(new URL(forecastUrl(n)).searchParams.get('hourly').includes('visibility'));
 const missing=normalizeForecast({hourly:{time:[at/1000,at/1000+3600]}},n,at);
 assert.equal(weatherAt(at,missing).snowfall,null);assert.equal(weatherAt(at,missing).visibility,null);
});

test('forecast refresh anchors preserve cloud position without reseeding',async()=>{
 const {cloudDisplacement}=await import('../../js/weather-environment.js');
 const at=Date.parse('2026-06-21T12:00Z');
 const old={hourly:[{at:at-3600000,windSpeed:4,windDirection:90},{at:at+3600000,windSpeed:4,windDirection:90}]};
 const position=cloudDisplacement(at,old,{});
 const fresh={hourly:[{at:at-7200000,windSpeed:10,windDirection:180},{at:at+7200000,windSpeed:15,windDirection:170}],windAnchor:{at,...position}};
 const next=cloudDisplacement(at,fresh,{});
 assert(Math.hypot(next.x-position.x,next.y-position.y)<1e-10);
 const after=cloudDisplacement(at+10,fresh,{});
 assert(Math.hypot(after.x-next.x,after.y-next.y)<.00001);
});

test('wind alters final cloud shadows without altering the brightness budget',async()=>{
 const {evaluateEnvironment}=await import('../../js/environment.js');
 const {DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const {LightingEngine}=await import('../../js/effects.js');
 const at=Date.parse('2026-06-21T12:00Z'),n={...DEFAULT_NATURAL,latitude:0,longitude:0};
 const engine=new LightingEngine(7319),results=[];
 for(const [windSpeed,windDirection] of [[1,90],[25,90],[25,0]]){
  const w={source:'simulation',cloud:50,rain:0,windSpeed,windDirection};
  const c=evaluateEnvironment(at,n,DEFAULT_SAFETY,null,{weatherOverride:w});
  const state=engine.state(c.preset,0);
  results.push({brightness:c.brightness,field:Array.from({length:100},(_,i)=>engine.sample(state,(i%10)/9,Math.floor(i/10)/9).cloudOpening)});
 }
 for(const r of results.slice(1)){
  assert.equal(r.brightness,results[0].brightness);
  assert(r.field.reduce((sum,v,i)=>sum+Math.abs(v-results[0].field[i]),0)/100>.01);
 }
});
test('provider refresh persists its wind anchor through cache reload',async()=>{
 const {createWeatherProvider,WEATHER_TTL}=await import('../../js/weather.js');
 const {cloudDisplacement}=await import('../../js/weather-environment.js');
 let now=Date.parse('2026-06-21T12:00Z'),calls=0;
 const n={latitude:0,longitude:0,timezone:'UTC'},cache=new Map();
 const storage={getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)};
 const provider=createWeatherProvider({now:()=>now,storage,fetcher:async()=>({ok:true,json:async()=>({hourly:{time:[now/1000-3600,now/1000+3600],wind_speed_10m:[++calls*2,10],wind_direction_10m:[90,180]}})})});
 await provider.refresh(n);const old=provider.snapshot().data;
 now+=WEATHER_TTL+1;const expected=cloudDisplacement(now,old,{});
 await provider.refresh(n);const fresh=provider.snapshot().data;
 assert.deepEqual(cloudDisplacement(now,fresh,{}),expected);
 const reload=createWeatherProvider({now:()=>now,storage,fetcher:()=>{throw Error('fresh cache should avoid request');}});
 await reload.refresh(n);assert.deepEqual(reload.snapshot().data.windAnchor,fresh.windAnchor);
});

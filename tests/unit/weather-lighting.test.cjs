const test=require('node:test');
const assert=require('node:assert/strict');
test('cloud openings retain spatial contrast when the material safety floor is one',async()=>{
 const {calculateNaturalLighting,DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const {PREVIEW_WEATHER}=await import('../../js/preview-weather.js');
 const {LightingEngine}=await import('../../js/effects.js');
 const {LightField}=await import('../../js/light-field.js');
 const cycle=calculateNaturalLighting(Date.parse('2026-06-21T12:00Z'),{...DEFAULT_NATURAL,latitude:0,longitude:0},DEFAULT_SAFETY,null,{weatherOverride:PREVIEW_WEATHER.cloudy});
 const engine=new LightingEngine(),state=engine.state({...cycle.preset,cloudTransmissionFloor:1},0);
 const field=new LightField().update(engine,state),openings=[];
 for(let x=0;x<20;x++){
  const light=field.sample(x/19,.12);assert.equal(light.transmission,1);
  assert(light.cloudOpening>=0&&light.cloudOpening<=1);openings.push(light.cloudOpening);
 }
 assert(Math.max(...openings)-Math.min(...openings)>.2);
});
test('preview samples its selected date/time and retains raw forecast provenance',async()=>{
 const {createPreviewController}=await import('../../js/controllers.js');
 const {normalizeForecast}=await import('../../js/weather.js');
 const {DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const {DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS}=await import('../../js/schedule.js');
 const at=Date.parse('2026-06-21T12:00Z'),n={...DEFAULT_NATURAL,latitude:0,longitude:0};
 const data=normalizeForecast({hourly:{time:[at/1000,at/1000+3600,at/1000+86400],cloud_cover:[0,50,100]}},n,at);
 const preview=createPreviewController(DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,720,{natural:n,safety:DEFAULT_SAFETY,data,date:'2026-06-21',now:at});
 assert.equal(preview.snapshot().weather.cloud,0);
 preview.scrub(750);const w=preview.snapshot().weather;
 assert.equal(w.cloud,25);assert.deepEqual(w.forecast,{from:at,to:at+3600000,fraction:.5,cloudFrom:0,cloudTo:50});
 preview.setDate('2026-06-22');preview.scrub(720);assert.equal(preview.snapshot().weather.cloud,100);
 preview.scrub(0);assert.equal(preview.snapshot().brightness,0);
 const missing=normalizeForecast({hourly:{time:[at/1000,at/1000+3600]}},n,at);
 const p=createPreviewController(DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,720,{natural:n,safety:DEFAULT_SAFETY,data:missing,date:'2026-06-21',now:at});
 assert.equal(p.snapshot().weather.forecast.cloudFrom,null);
 assert.equal(p.snapshot().weather.directRadiation,null);
});
test('weather reaches the 2D field with bounded daylight and coherent motion',async()=>{
 const {calculateNaturalLighting,DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const {PREVIEW_WEATHER}=await import('../../js/preview-weather.js');
 const {LightingEngine}=await import('../../js/effects.js');
 const {normalizeForecast}=await import('../../js/weather.js');
 const n={...DEFAULT_NATURAL,latitude:0,longitude:0},at=Date.parse('2026-06-21T12:00Z');
 const results={};
 for(const [name,weather] of Object.entries(PREVIEW_WEATHER)){
  const raw={current:{time:at/1000,cloud_cover:weather.cloud,precipitation:weather.precipitation,weather_code:weather.code},hourly:{time:[at/1000-3600,at/1000+3600],cloud_cover:[weather.cloud,weather.cloud],precipitation:[weather.precipitation,weather.precipitation],weather_code:[weather.code,weather.code]}};
  const data=normalizeForecast(raw,n,at),cycle=calculateNaturalLighting(at,n,DEFAULT_SAFETY,data,{current:true});
  assert.equal(cycle.weather.cloud,weather.cloud);assert.equal(cycle.weather.source,'current');
  const engine=new LightingEngine(),sample=t=>{const state=engine.state(cycle.preset,t);return Array.from({length:240},(_,i)=>engine.sample(state,(i%20)/19,Math.floor(i/20)/11));};
  const a=sample(0),b=sample(30),near=sample(30+1/30),luma=v=>(v.r+v.g+v.b)/3;
  const values=a.map(luma),mean=values.reduce((a,b)=>a+b)/values.length;
  results[name]={mean,range:Math.max(...values)-Math.min(...values),motion:a.reduce((sum,v,i)=>sum+Math.abs(luma(v)-luma(b[i])),0)/a.length};
  assert(Math.max(...b.map((v,i)=>Math.abs(luma(v)-luma(near[i]))))<.01);
  assert.equal(engine.state(cycle.preset,5.77).flash,0);
  if(name==='overcast'||name==='thunderstorm')assert.equal(cycle.preset.shaftStrength,0);
  if(name==='partly-cloudy')assert(cycle.preset.shaftStrength>0&&cycle.preset.shaftStrength<=.22);
  assert(cycle.brightness<=DEFAULT_SAFETY.maxBrightness);
  const night=calculateNaturalLighting(at+12*3600000,n,DEFAULT_SAFETY,data,{weatherOverride:weather});assert.equal(night.brightness,0);
 }
 assert(results.cloudy.mean<results.clear.mean*.93);
 assert(results.overcast.range<results['partly-cloudy'].range);
 assert(results['partly-cloudy'].motion>.002);
 assert(results.overcast.mean>=results.clear.mean*DEFAULT_SAFETY.minWeatherFactor);
 console.log(results);
});
test('weather override remains inside preview and hardware gates reject it',async()=>{
 const {createStore}=await import('../../js/state.js');
 const {createPreviewController,createRealLightingController}=await import('../../js/controllers.js');
 const {prepareRealHardwareOutput}=await import('../../js/hardware-output.js');
 const store=createStore(),s=store.getState(),at=Date.parse('2026-06-21T12:00Z');
 const n={...s.natural,latitude:0,longitude:0};let emitted=0;
 const real=createRealLightingController(store,()=>new Date(at));real.subscribeRealOutput(()=>emitted++);const before=real.sample();
 const preview=createPreviewController(s.schedule,s.cycleSettings,720,{natural:n,safety:s.safety,date:'2026-06-21',now:at});
 for(const name of ['clear','partly-cloudy','cloudy','overcast','rain','thunderstorm']){
  preview.setWeatherOverride(name);const output=preview.snapshot();assert.equal(output.minutes,720);assert.equal(output.weather.source,'simulation');
  assert.throws(()=>prepareRealHardwareOutput(output,s.safety));
 }
 assert.equal(real.getOutput(),before);assert.equal(emitted,1);assert.equal(store.getState(),s);
 preview.setWeatherOverride(null);assert.notEqual(preview.snapshot().weather.source,'simulation');
 assert.throws(()=>preview.setWeatherOverride('invalid'));
 preview.setPlaying(true);preview.setSpeed(1440);preview.advance(5);assert.equal(preview.snapshot().minutes,840);
});

test('documented horizontal radiation survives parsing, interpolation and shared lighting',async()=>{
 const {forecastUrl,normalizeForecast,weatherAt,smoothWeather}=await import('../../js/weather.js');
 const {weatherLightingModel,calculateNaturalLighting,DEFAULT_NATURAL}=await import('../../js/natural.js');
 const {DEFAULT_SAFETY}=await import('../../js/safety.js');
 const n={...DEFAULT_NATURAL,latitude:0,longitude:0},at=Date.parse('2026-06-21T12:00Z');
 const url=new URL(forecastUrl(n));
 for(const field of ['direct_radiation','diffuse_radiation','cloud_cover_low','cloud_cover_mid','cloud_cover_high'])assert(url.searchParams.get('hourly').split(',').includes(field));
 assert.equal(url.searchParams.get('wind_speed_unit'),'ms');
 const raw={hourly:{time:[at/1000-3600,at/1000+3600],cloud_cover:[45,45],direct_radiation:[600,0],diffuse_radiation:[100,300]}};
 const data=normalizeForecast(raw,n,at),w=weatherAt(at,data,at);
 assert.equal(w.directRadiation,300);assert.equal(w.diffuseRadiation,200);assert.equal(w.low,null);
 const direct=weatherLightingModel({...w,directRadiation:600,diffuseRadiation:100},1);
 const diffuse=weatherLightingModel({...w,directRadiation:0,diffuseRadiation:300},1);
 assert(direct.direct>diffuse.direct);assert(diffuse.ambient>direct.ambient);assert.equal(diffuse.direct,0);
 assert.equal(direct.radiationSource,'forecast radiation');
 assert.equal(weatherLightingModel({...w,directRadiation:null},1).radiationSource,'cloud approximation');
 assert.equal(weatherLightingModel({...w,directRadiation:0,diffuseRadiation:0},1).radiationSource,'cloud approximation');
 assert.equal(weatherLightingModel(w,-.1).direct,0);
 const cycle=calculateNaturalLighting(at,n,DEFAULT_SAFETY,data);
 assert.equal(cycle.weatherLighting.radiationSource,'forecast radiation');
 assert.equal(cycle.preset.lighting.direct,cycle.weatherLighting.directIllumination);
 const smoothed=smoothWeather({...w,directRadiation:0},w,1);
 assert(smoothed.directRadiation>0&&smoothed.directRadiation<10);
 assert.equal(smoothWeather({cloud:40},w,1).directRadiation,300);
});

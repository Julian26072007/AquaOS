const test=require('node:test');
const assert=require('node:assert/strict');
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
 assert(cycle.channels.coolWhite>0);
 const smoothed=smoothWeather({...w,directRadiation:0},w,1);
 assert(smoothed.directRadiation>0&&smoothed.directRadiation<10);
 assert.equal(smoothWeather({cloud:40},w,1).directRadiation,300);
});

const test=require('node:test'),assert=require('node:assert/strict');
const load=Promise.all(['environment','natural','safety','lighting'].map(m=>import(`../../js/${m}.js`)));
const at=Date.parse('2026-06-21T12:00Z');
const clear={source:'simulation',cloud:0,rain:0,snowfall:0,windSpeed:4,directRadiation:500,diffuseRadiation:100};
async function fixture(){
  const [{evaluateEnvironment},{DEFAULT_NATURAL},{DEFAULT_SAFETY},{CHANNELS,OFF}]=await load;
  const config={...DEFAULT_NATURAL,latitude:0,longitude:0};
  const sample=(weather,epoch=at)=>evaluateEnvironment(epoch,config,DEFAULT_SAFETY,null,{weatherOverride:{...clear,...weather}});
  return {sample,CHANNELS,OFF,policy:DEFAULT_SAFETY};
}

test('global weather keeps independent sun, clouds, rain, snow and haze inputs',async()=>{
  const {sample,CHANNELS,OFF,policy}=await fixture();
  const sun=sample({}),overcast=sample({cloud:100,directRadiation:0,diffuseRadiation:100});
  const partly=sample({cloud:35}),rain=sample({cloud:35,rain:3}),snow=sample({cloud:35,snowfall:1}),haze=sample({cloud:35,visibility:2000});
  assert(sun.brightness>partly.brightness&&partly.brightness>overcast.brightness);
  assert(overcast.brightness>=sun.brightness*policy.minWeatherFactor);
  assert(overcast.weatherLighting.diffuseFraction>sun.weatherLighting.diffuseFraction);
  assert(rain.environment.rainIntensity>0&&rain.weatherLighting.direct>0);
  assert(snow.environment.snowIntensity>0&&snow.weatherLighting.direct>0);
  assert(haze.environment.haze>partly.environment.haze);
  for(const sample of [rain,snow,haze]){
    assert(sample.brightness<partly.brightness);
    assert.notDeepEqual(sample.channels,partly.channels);
  }
  for(const cycle of [sun,overcast,partly,rain,snow,haze]){
    assert.deepEqual(Object.keys(cycle.channels),CHANNELS);
    assert(Object.values(cycle.channels).every(v=>Number.isFinite(v)&&v>=0&&v<=policy.maxBrightness));
  }
  assert.deepEqual(sample({cloud:100,rain:8},at+12*3600000).channels,OFF);
});

test('passing clouds dim and open gradually while wind changes the time pattern',async()=>{
  const {sample}=await fixture();
  const curve=windSpeed=>Array.from({length:181},(_,i)=>sample({cloud:50,windSpeed},at+i*10000).brightness);
  const slow=curve(1),fast=curve(20);
  assert(Math.max(...slow)-Math.min(...slow)>.01);
  assert(slow.some((v,i)=>i>0&&v>slow[i-1])&&slow.some((v,i)=>i>0&&v<slow[i-1]));
  assert(slow.slice(1).every((v,i)=>Math.abs(v-slow[i])<.004));
  assert.notDeepEqual(slow,fast);
  assert.deepEqual(curve(1),slow);
  assert.deepEqual(sample({cloud:50,windDirection:90}).channels,sample({cloud:50,windDirection:270}).channels);
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

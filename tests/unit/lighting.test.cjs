const test=require('node:test'),assert=require('node:assert/strict');
const load=Promise.all(['lighting','presets','environment','controllers','state','hardware'].map(name=>import(`../../js/${name}.js`)));
const noon=Date.parse('2026-06-21T12:00Z');
const difference=(a,b)=>Math.max(...Object.keys(a).map(key=>Math.abs(a[key]-b[key])));

test('all nine presets and custom manual levels use the same normalized channels',async()=>{
  const [{CHANNELS},{presets},{evaluateManualLighting},{createRealLightingController},{createStore}]=await load;
  const outputs=presets.map(preset=>evaluateManualLighting(preset,noon));
  assert.equal(new Set(outputs.map(value=>JSON.stringify(value))).size,9);
  for(const channels of outputs){
    assert.deepEqual(Object.keys(channels),CHANNELS);
    assert(Object.values(channels).every(level=>Number.isFinite(level)&&level>=0&&level<=1));
  }
  const sunrise=presets.find(p=>p.id==='sunrise'),sunset=presets.find(p=>p.id==='sunset');
  assert(evaluateManualLighting(sunrise,noon,120).warmWhite>evaluateManualLighting(sunrise,noon).warmWhite);
  assert(evaluateManualLighting(sunset,noon,120).warmWhite<evaluateManualLighting(sunset,noon).warmWhite);
  const storage={value:'{"version":3,"presetId":"moon"}',getItem(){return this.value;},setItem(_,value){this.value=value;}};
  const store=createStore(storage);
  assert.equal(store.getState().presetId,'moonlight');
  store.setManualChannels({red:.45,green:2,blue:-1,warmWhite:.27,coolWhite:NaN});
  const restored=createStore(storage);
  const real=createRealLightingController(restored,()=>new Date(noon));
  assert.deepEqual(real.sample().channels,{red:.45,green:1,blue:0,warmWhite:.27,coolWhite:0});
  restored.selectPreset('moonlight');
  assert.equal(restored.getState().manualChannels,null);
});

test('mode and preset changes fade from the applied levels and survive interruptions',async()=>{
  const [,{getPreset},{evaluateManualLighting},{createRealLightingController},{createStore}]=await load;
  const store=createStore();
  let at=noon;
  const real=createRealLightingController(store,()=>new Date(at));
  const first=real.sample();
  store.setMode('automatic');
  assert.deepEqual(real.sample().channels,first.channels);
  at+=750;
  const midway=real.sample();
  assert(difference(midway.channels,first.channels)>.01);
  assert(difference(midway.channels,midway.cycle.channels)>.01);
  store.selectPreset('sunset');
  assert.deepEqual(real.sample().channels,midway.channels);
  at+=1500;
  assert.deepEqual(real.sample().channels,evaluateManualLighting(getPreset('sunset'),at,1.5));
  store.setMode('natural');
  assert.deepEqual(real.sample().channels,evaluateManualLighting(getPreset('sunset'),at,1.5));
  at+=1500;
  const day=real.sample();
  assert(day.channels.warmWhite<.01,'Natural retains its startup limit');
});

test('DMX maps exactly five global levels and protects darkness and slew',async()=>{
  const [{OFF},,,,{createStore},{mapDmxChannels,prepareRealHardwareOutput}]=await load;
  const levels={red:1,green:.5,blue:0,warmWhite:.25,coolWhite:.75};
  assert.deepEqual(mapDmxChannels(levels),{1:255,2:128,3:0,4:64,5:191});
  assert.deepEqual(mapDmxChannels(levels,{red:8,green:9,blue:10,warmWhite:11,coolWhite:12}),{8:255,9:128,10:0,11:64,12:191});
  for(const red of [2,6,0,513,1.1])assert.throws(()=>mapDmxChannels(levels,{red,green:2,blue:3,warmWhite:4,coolWhite:5}));
  const {safety}=createStore().getState();
  const sample={source:'real',mode:'natural',at:noon,cycle:{phase:'Daylight'},channels:levels};
  const startup=prepareRealHardwareOutput(sample,safety);
  assert.deepEqual(startup.channels,OFF);
  const next=prepareRealHardwareOutput({...sample,at:noon+5000},safety,undefined,startup);
  assert(next.channels.red>0&&next.channels.red<=safety.maxChangePerMinute*5/60);
  assert.deepEqual(prepareRealHardwareOutput({...sample,cycle:{darknessRequired:true}},safety,undefined,next).channels,OFF);
  assert.throws(()=>prepareRealHardwareOutput({...sample,source:'preview'},safety));
  const moon=prepareRealHardwareOutput({...sample,at:noon+5000,cycle:{phase:'Moonlight'}},safety,undefined,next);
  assert.equal(moon.dmx[1],0,'one DMX step exceeds the default moonlight ceiling');
});

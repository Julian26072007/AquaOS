const test = require('node:test');
const assert = require('node:assert/strict');

// Existing domain regressions run directly against the same ES modules as the browser.
test('schedule domain regressions', async () => {
 const result=await (async()=>{
  const {calculateLightingAtTime:calc,DEFAULT_SCHEDULE:s,DEFAULT_CYCLE_SETTINGS:c,validateSchedule,localMinutes}=await import('../../js/schedule.js');
  const {createStore}=await import('../../js/state.js');const {createRealLightingController,createPreviewController}=await import('../../js/controllers.js');
  const {LightingEngine}=await import('../../js/effects.js');const {LightField}=await import('../../js/light-field.js');const {mapLightField}=await import('../../js/hardware.js');
  const {LightingEngine:Engine}=await import('../../js/effects.js');const e=new Engine();
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
 })();
 assert(result.daylightRGBIncreases);
 assert.deepEqual(result.phases,['Night','Night','Sunrise','Sunrise','Daylight','Daylight','Sunset','Sunset','Night','Night','Night']);
 assert(result.boundaries.every(v=>v<.00001));assert(result.channelContinuity.every(v=>v<.0001));assert.equal(result.invalid,4);assert.equal(result.midnightPhase,'Sunrise');
 assert.deepEqual(result.speeds,[1,6,24]);assert.equal(result.loop,23);assert.equal(result.paused,23);assert(result.realUntouched);assert(result.stateUntouched);assert.equal(result.actualPhase,'Night');assert.equal(result.manualId,'waves');assert(result.scheduleUnchanged);assert.equal(result.restoredMode,'automatic');assert.equal(result.localMinutes,390);assert.equal(result.moonBrightness,.02);
 for(const assembly of result.night)for(const values of Object.values(assembly.channels))assert(values.every(v=>v===0),'night commands must be off');

});

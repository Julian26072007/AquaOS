const test=require('node:test');
const assert=require('node:assert/strict');
const load=Promise.all(['environment','natural','safety','weather','controllers','schedule'].map(m=>import(`../../js/${m}.js`)));
const base=Date.parse('2026-06-21T00:00Z');
async function fixture(){
  const [env,n,s,w,c,schedule]=await load;
  const natural={...n.DEFAULT_NATURAL,latitude:0,longitude:0};
  const time=Array.from({length:49},(_,i)=>base/1000+i*3600);
  const data=w.normalizeForecast({hourly:{time,cloud_cover:time.map((_,i)=>i%3*45),precipitation:time.map((_,i)=>i%3*2),weather_code:time.map((_,i)=>i%2?95:0),wind_direction_10m:time.map((_,i)=>i%2?359:1),direct_radiation:time.map((_,i)=>i%3?500:0),diffuse_radiation:time.map((_,i)=>i%3?100:0)}},natural,base);
  const evaluate=epoch=>env.evaluateEnvironment(epoch,natural,s.DEFAULT_SAFETY,data,{now:base});
  return {evaluate,natural,data,c,s,schedule};
}
test('global output is deterministic across evaluation order',async()=>{
  const {evaluate}=await fixture(),at=base+12.4*3600000;
  const expected=evaluate(at).channels;
  for(const t of [at+3600000,base,at-10000,at])evaluate(t);
  assert.deepEqual(evaluate(at).channels,expected);
});
test('forecast categories, radiation, sunrise, sunset and midnight have continuous final channels',async()=>{
  const {evaluate}=await fixture();
  const plan=evaluate(base+12*3600000).plan;
  const boundaries=[...Array.from({length:47},(_,i)=>base+(i+1)*3600000),base+11.5*3600000,plan.start,plan.start+plan.rise*60000,plan.dayEnd-plan.set*60000,plan.dayEnd,plan.end];
  for(const at of boundaries){
    const a=evaluate(at-10),b=evaluate(at+10);
    assert(Math.abs(a.brightness-b.brightness)<.0001,`brightness ${new Date(at).toISOString()}`);
    const left=a.channels,right=b.channels;
    for(const key of ['red','green','blue','warmWhite','coolWhite']){
      assert(Number.isFinite(right[key]),key);
      assert(right[key]>=0&&right[key]<=1,key);
      assert(Math.abs(left[key]-right[key])<.002,`${key} at ${new Date(at).toISOString()}`);
    }
  }
});
test('preview speeds, forward/backward scrubbing and date rollover share targets',async()=>{
  const {natural,data,c,s,schedule}=await fixture();
  const make=()=>c.createPreviewController(schedule.DEFAULT_SCHEDULE,schedule.DEFAULT_CYCLE_SETTINGS,720,{natural,safety:s.DEFAULT_SAFETY,data,date:'2026-06-21',now:base});
  const reference=make();reference.scrub(750);const expected=reference.snapshot().channels;
  for(const speed of [60,360,1440,3600]){
    const p=make();p.setSpeed(speed);p.setPlaying(true);p.advance(1800/speed);
    assert.deepEqual(p.snapshot().channels,expected);
    p.scrub(1000);p.scrub(400);p.scrub(750);assert.deepEqual(p.snapshot().channels,expected);
  }
  const p=make();p.scrub(1439);p.setSpeed(3600);p.setPlaying(true);p.advance(1);
  assert.equal(p.snapshot().date,'2026-06-22');assert.equal(p.snapshot().minutes,59);
});
test('current observation windows and missing forecast rows do not switch abruptly',async()=>{
  const [,n,s,w]=await load,natural={...n.DEFAULT_NATURAL,latitude:0,longitude:0};
  const at=base+12*3600000;
  const data=w.normalizeForecast({current:{time:at/1000,cloud_cover:100,weather_code:95},hourly:{time:[at/1000-3600,at/1000,at/1000+3600],cloud_cover:[10,null,90],direct_radiation:[500,null,0]}},natural,base);
  for(const t of [at-1800000,at,at+1800000]){
    const a=w.weatherAt(t-1,data,base,{current:true}),b=w.weatherAt(t+1,data,base,{current:true});
    for(const key of ['cloud','storm','directRadiation'])assert(Math.abs(a[key]-b[key])<.001,key);
  }
});
test('automatic preview channels also ignore playback speed and scrub history',async()=>{
  const {c,schedule}=await fixture();
  const make=()=>c.createPreviewController(schedule.DEFAULT_SCHEDULE,schedule.DEFAULT_CYCLE_SETTINGS,720);
  const reference=make();reference.scrub(750);const expected=reference.snapshot().channels;
  for(const speed of [60,360,1440,3600]){
    const p=make();p.setSpeed(speed);p.setPlaying(true);p.advance(1800/speed);
    assert.deepEqual(p.snapshot().channels,expected);
    p.scrub(1200);p.scrub(750);assert.deepEqual(p.snapshot().channels,expected);
  }
});

test('forecast coverage edges fade to fallback during daylight',async()=>{
  const [,n,s,w]=await load,natural={...n.DEFAULT_NATURAL,latitude:0,longitude:0};
  const at=base+12*3600000;
  const data=w.normalizeForecast({hourly:{time:[at/1000-1800,at/1000+1800],cloud_cover:[100,0]}},natural,at);
  const [env]=await load;
  const channels=epoch=>env.evaluateEnvironment(epoch,natural,s.DEFAULT_SAFETY,data,{now:at}).channels;
  for(const edge of data.hourly.map(row=>row.at)){
    const before=channels(edge-10),after=channels(edge+10);
    for(const key of Object.keys(before))assert(Math.abs(before[key]-after[key])<.0001,key);
  }
  assert.notDeepEqual(channels(at),env.evaluateEnvironment(at,natural,s.DEFAULT_SAFETY).channels);
});

test('accelerated Natural playback crosses the repeated DST hour on its absolute clock',async()=>{
  const {natural,s,c,schedule}=await fixture();
  const n={...natural,latitude:48.2,longitude:16.4,timezone:'Europe/Vienna'};
  const p=c.createPreviewController(schedule.DEFAULT_SCHEDULE,schedule.DEFAULT_CYCLE_SETTINGS,110,{natural:n,safety:s.DEFAULT_SAFETY,date:'2026-10-25'});
  const start=p.snapshot().at;
  p.setSpeed(60);p.setPlaying(true);
  for(let i=0;i<80;i++)p.advance(1);
  assert.equal(p.snapshot().at,start+80*60000);
  assert.equal(p.snapshot().minutes,130);
});

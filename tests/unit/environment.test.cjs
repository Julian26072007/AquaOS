const test=require('node:test');
const assert=require('node:assert/strict');
const load=Promise.all(['environment','natural','safety','weather','effects','controllers','schedule','light-field'].map(m=>import(`../../js/${m}.js`)));
const base=Date.parse('2026-06-21T00:00Z');
async function fixture(){
  const [env,n,s,w,e,c,schedule,f]=await load;
  const natural={...n.DEFAULT_NATURAL,latitude:0,longitude:0};
  const time=Array.from({length:49},(_,i)=>base/1000+i*3600);
  const data=w.normalizeForecast({hourly:{time,cloud_cover:time.map((_,i)=>i%3*45),precipitation:time.map((_,i)=>i%3*2),weather_code:time.map((_,i)=>i%2?95:0),wind_direction_10m:time.map((_,i)=>i%2?359:1),direct_radiation:time.map((_,i)=>i%3?500:0),diffuse_radiation:time.map((_,i)=>i%3?100:0)}},natural,base);
  const evaluate=epoch=>env.evaluateEnvironment(epoch,natural,s.DEFAULT_SAFETY,data,{now:base});
  const engine=new e.LightingEngine(7319);
  const field=cycle=>{
    const state=engine.state(cycle.preset,123);
    const grid=new f.LightField().update(engine,state);
    return [0,.25,.5,.75,1].flatMap(x=>[.2,.8].map(y=>({...grid.sample(x,y)})));
  };
  return {evaluate,field,natural,data,c,s,schedule,engine};
}
test('final field is deterministic across evaluation order, seeds and renderer clocks',async()=>{
  const {evaluate,field,engine}=await fixture(),at=base+12.4*3600000;
  const a=evaluate(at),expected=field(a);
  const [,,,,effects]=await load;
  const fresh=new effects.LightingEngine(7319);
  assert.deepEqual(engine.sample(engine.state(a.preset,0),.3,.6),fresh.sample(fresh.state(a.preset,0),.3,.6));
  for(const t of [at+3600000,base,at-10000,at])field(evaluate(t));
  assert.deepEqual(field(evaluate(at)),expected);
  assert.deepEqual(engine.sample(engine.state(a.preset,0),.3,.6),engine.sample(engine.state(a.preset,9999),.3,.6));
});
test('forecast categories, radiation, sunrise, sunset and midnight have continuous final channels',async()=>{
  const {evaluate,field}=await fixture();
  const plan=evaluate(base+12*3600000).plan;
  const boundaries=[...Array.from({length:47},(_,i)=>base+(i+1)*3600000),base+11.5*3600000,plan.start,plan.start+plan.rise*60000,plan.dayEnd-plan.set*60000,plan.dayEnd,plan.end];
  for(const at of boundaries){
    const a=evaluate(at-10),b=evaluate(at+10);
    assert(Math.abs(a.brightness-b.brightness)<.0001,`brightness ${new Date(at).toISOString()}`);
    const left=field(a),right=field(b);
    for(let i=0;i<left.length;i++)for(const key of ['r','g','b','red','green','blue','warmWhite','coolWhite','transmission','cloudOpening']){
      assert(Number.isFinite(right[i][key]),key);
      assert(right[i][key]>=0&&right[i][key]<=1,key);
      assert(Math.abs(left[i][key]-right[i][key])<.002,`${key} at ${new Date(at).toISOString()}`);
    }
  }
});
test('preview speeds, forward/backward scrubbing and date rollover share targets',async()=>{
  const {field,natural,data,c,s,schedule}=await fixture();
  const make=()=>c.createPreviewController(schedule.DEFAULT_SCHEDULE,schedule.DEFAULT_CYCLE_SETTINGS,720,{natural,safety:s.DEFAULT_SAFETY,data,date:'2026-06-21',now:base});
  const reference=make();reference.scrub(750);const expected=field(reference.snapshot());
  for(const speed of [60,360,1440,3600]){
    const p=make();p.setSpeed(speed);p.setPlaying(true);p.advance(1800/speed);
    assert.deepEqual(field(p.snapshot()),expected);
    p.scrub(1000);p.scrub(400);p.scrub(750);assert.deepEqual(field(p.snapshot()),expected);
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
test('automatic preview final fields also ignore playback speed and renderer history',async()=>{
  const {field,c,schedule}=await fixture();
  const make=()=>c.createPreviewController(schedule.DEFAULT_SCHEDULE,schedule.DEFAULT_CYCLE_SETTINGS,720);
  const reference=make();reference.scrub(750);const expected=field(reference.snapshot());
  for(const speed of [60,360,1440,3600]){
    const p=make();p.setSpeed(speed);p.setPlaying(true);p.advance(1800/speed);
    assert.deepEqual(field(p.snapshot()),expected);
    p.scrub(1200);p.scrub(750);assert.deepEqual(field(p.snapshot()),expected);
  }
});

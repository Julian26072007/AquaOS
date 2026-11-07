const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 const page=await browser.newPage({viewport:{width:390,height:664},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=testUrl;await page.goto(url);
 const result=await page.evaluate(async()=>{
  const {LightingEngine,LightingPass,DEFAULT_ASSEMBLIES}=await import('./js/effects.js');
  const {LightField,FIELD_CHANNELS}=await import('./js/light-field.js');
  const {mapLightField,UNIFORM_CAPABILITIES}=await import('./js/hardware-mapping.js');
  const {getPreset}=await import('./js/presets.js');
  const engine=new LightingEngine(),field=new LightField(),p=getPreset('clouds'),state=engine.state(p,30);
  field.update(engine,state);
  const left=field.sample(.1,.5),right=field.sample(.9,.5),rear=field.sample(.5,.1),front=field.sample(.5,.9);
  let depthContrast=0;
  for(let i=0;i<30;i++)depthContrast=Math.max(depthContrast,Math.abs(field.sample(i/29,.1).r-field.sample(i/29,.9).r));
  const thermalRear=field.sample(.5,0),thermalFront=field.sample(.5,1);
  const uniform=mapLightField(field);
  const mixed=mapLightField(field,UNIFORM_CAPABILITIES.map(c=>({...c,segments:{red:12,green:12,blue:12,warmWhite:1,coolWhite:0}})));
  // Test footprints/segment orientation with an analytic field independent of
  // the procedural implementation: RGB varies in x, whites vary in y.
  const analytic=new LightField(32,16);
  for(let y=0;y<16;y++)for(let x=0;x<32;x++){
    const i=(y*32+x)*analytic.stride;
    for(let k=0;k<FIELD_CHANNELS.length;k++)analytic.data[i+k]=['warmWhite','coolWhite'].includes(FIELD_CHANNELS[k])?y/15:x/31;
  }
  const reference=mapLightField(analytic),segmented=mapLightField(analytic,UNIFORM_CAPABILITIES.map(c=>({...c,segments:{red:4,warmWhite:1}})));
  let invalid=false;try{mapLightField(field,[{id:'rear',bounds:{x0:0,x1:1,y0:0,y1:1},segments:{red:-1}}]);}catch{invalid=true;}
  // Isolate the two independent conceptual assemblies, including white channels.
  const darkFront=DEFAULT_ASSEMBLIES.map(s=>({...s,gain:s.id==='front'?0:1}));
  const isolated=engine.sample(engine.state(p,30,false,darkFront),.5,.7);
  let flashChannelRise=0;
  for(let t=5;t<8;t+=.025){const s=engine.state({...getPreset('storm'),allowLightning:true},t);if(s.flash){const lit=engine.sample(s,.5,.5),dark=engine.sample({...s,flash:0},.5,.5);flashChannelRise=Math.max(flashChannelRise,lit.coolWhite-dark.coolWhite);}}
  const noWarm=DEFAULT_ASSEMBLIES.map(s=>({...s,warmWhite:0}));
  const noWarmSample=engine.sample(engine.state(p,30,false,noWarm),.5,.7);
  // A cloud varies smoothly with either overhead coordinate and drifts in both.
  const driftX=engine.clouds(.2,.3,0),driftY=engine.clouds(.2,.3,30);
  const gradientY=Math.abs(engine.clouds(.4,.1,30)-engine.clouds(.4,.9,30));
  function driftError(dx,dy){
    let error=0;
    for(let row=0;row<10;row++)for(let col=0;col<12;col++){
      const x=col/16,y=row/14;
      error+=Math.abs(engine.clouds(x,y,0)-engine.clouds(x+dx,y+dy,15));
    }
    return error/120;
  }
  const motionError={both:driftError(.14375,.097),onlyX:driftError(.14375,0),onlyY:driftError(0,.097),stationary:driftError(0,0)};
  let continuity=0;
  for(let i=0;i<100;i++)continuity=Math.max(continuity,Math.abs(engine.clouds(i/100,.4,30)-engine.clouds(i/100+.0001,.4001,30.01)));
  const lighting=new LightingPass();lighting.prepare(p,p,1,30,false);
  const rearMaterial=lighting.color('#81c6c0',.5,.1,.5),frontMaterial=lighting.color('#81c6c0',.5,.9,.5);
  // Screen height (z) attenuates a fixed overhead sample, not its y coordinate.
  const fieldBefore=lighting.field.sample(.5,.1).transmission;lighting.color('#81c6c0',.5,.1,.9);const fieldAfter=lighting.field.sample(.5,.1).transmission;
  return {flashChannelRise,motionError,depthContrast,left,right,rear,front,uniform,mixed,reference,segmented,invalid,isolated,noWarmSample,driftX,driftY,gradientY,continuity,rearMaterial,frontMaterial,fieldBefore,fieldAfter,thermalRear,thermalFront};
 });
 assert(Math.abs(result.left.r-result.right.r)>.02);assert(result.depthContrast>.02);
 assert(Math.abs(result.driftX-result.driftY)>.03);assert(result.gradientY>.03);assert(result.continuity<.01);
 assert(result.motionError.both<result.motionError.onlyX&&result.motionError.both<result.motionError.onlyY,'pattern advection needs both spatial axes');
 assert.notEqual(result.rearMaterial,result.frontMaterial);assert.equal(result.fieldBefore,result.fieldAfter);
 assert(result.flashChannelRise>.05);
 assert.equal(result.isolated.front,0);assert(result.isolated.rear>0);assert.equal(result.noWarmSample.warmWhite,0);
 assert(Math.abs(result.thermalRear.warmWhite/result.thermalRear.coolWhite-result.thermalFront.warmWhite/result.thermalFront.coolWhite)>.001);
 for(const assembly of result.uniform)for(const values of Object.values(assembly.channels))assert.equal(values.length,1);
 for(const assembly of result.mixed){assert.equal(assembly.channels.red.length,12);assert.equal(assembly.channels.warmWhite.length,1);assert.equal(assembly.channels.coolWhite.length,0);}
 assert(Math.abs(result.reference[0].channels.red[0]-.5)<.002);assert(Math.abs(result.reference[0].channels.warmWhite[0]-.25)<.002);assert(Math.abs(result.reference[1].channels.warmWhite[0]-.75)<.002);
 result.segmented[0].channels.red.forEach((value,i)=>assert(Math.abs(value-(i+.5)/4)<.002));assert(result.invalid);
 await page.goto(new URL('dev/light-map.html',url).href);await page.selectOption('#view','cloud');await page.waitForTimeout(200);await page.screenshot({path:'/tmp/aquaos-top-down.png',fullPage:true});assert(await page.locator('#stats').textContent());
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(60);
 for(const t of [0,30]){
  await page.evaluate(async t=>{
   const {LightingEngine}=await import('../js/effects.js');const {LightField}=await import('../js/light-field.js');const {getPreset}=await import('../js/presets.js');
   const field=new LightField(),engine=new LightingEngine();field.update(engine,engine.state(getPreset('clouds'),t));
   const ctx=document.querySelector('canvas').getContext('2d'),pixels=ctx.createImageData(96,48);
   for(let i=0;i<96*48;i++){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=field.data[i*field.stride+8]*255;pixels.data[i*4+3]=255;}
   ctx.putImageData(pixels,0,0);
  },t);
  await page.locator('canvas').screenshot({path:`/tmp/aquaos-2d-field-${t}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS: independent 2D axes, thermal balance, broad independent assemblies, material depth, uniform/segmented/mixed channel mapping, footprint averaging, invalid capabilities, developer map.');console.log(JSON.stringify({maxFrontRearContrast:result.depthContrast,motionError:result.motionError,left:result.left.r,right:result.right.r,continuity:result.continuity},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

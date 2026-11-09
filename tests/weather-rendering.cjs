const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce'});
  await page.goto(testUrl);
  const result=await page.evaluate(async()=>{
   const {AquariumRenderer}=await import('./js/renderer.js');
   const {evaluateEnvironment}=await import('./js/environment.js');
   const {DEFAULT_NATURAL}=await import('./js/natural.js');
   const {DEFAULT_SAFETY}=await import('./js/safety.js');
   const {PREVIEW_WEATHER}=await import('./js/preview-weather.js');
   const at=Date.parse('2026-06-21T12:00Z'),natural={...DEFAULT_NATURAL,latitude:0,longitude:0};
   const sample=(epoch,weather)=>evaluateEnvironment(epoch,natural,DEFAULT_SAFETY,null,{weatherOverride:weather});
   const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
   const renderer=new AquariumRenderer(canvas,sample(at,PREVIEW_WEATHER.clear));renderer.setSuspended(true);
   function draw(output){
    renderer.setLighting(output);renderer.draw();
    const pixels=renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let total=0;
    for(let i=0;i<pixels.length;i+=4)total+=pixels[i]+pixels[i+1]+pixels[i+2];
    return {mean:total/(pixels.length*.75),image:canvas.toDataURL()};
   }
   const clear=draw(sample(at,PREVIEW_WEATHER.clear)),overcast=draw(sample(at,PREVIEW_WEATHER.overcast));
   const partly=PREVIEW_WEATHER['partly-cloudy'];
   const early=draw(sample(at,partly)),later=draw(sample(at+450000,partly));
   const replay=draw(sample(at,partly));
   const sunRain=draw(sample(at,{...partly,rain:4,directRadiation:450,diffuseRadiation:200}));
   const night=draw(sample(at+12*3600000,partly));
   renderer.destroy();
   return {clear:clear.mean,overcast:overcast.mean,night:night.mean,changed:early.image!==later.image,replay:early.image===replay.image,mixed:early.image!==sunRain.image};
  });
  assert(result.clear>result.overcast+3);
  assert(result.night<result.overcast*.2);
  assert(result.changed&&result.replay&&result.mixed);
  console.log(result);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

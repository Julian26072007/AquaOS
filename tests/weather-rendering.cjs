const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce'});
  await page.goto(testUrl);
  const {results,boundaries}=await page.evaluate(async()=>{
   const {AquariumRenderer}=await import('./js/renderer.js');
   const {createPreviewController}=await import('./js/controllers.js');
   const {normalizeForecast}=await import('./js/weather.js');
   const {DEFAULT_NATURAL}=await import('./js/natural.js');
   const {DEFAULT_SAFETY}=await import('./js/safety.js');
   const {DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS}=await import('./js/schedule.js');
   const {createScenery}=await import('./js/scenery.js');
   const at=Date.parse('2026-06-21T12:00:00Z'),natural={...DEFAULT_NATURAL,latitude:0,longitude:0};
   const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
   let renderer,clearPixels;const results=[];
   for(const cloud of [0,50,100]){
    const data=normalizeForecast({hourly:{time:[at/1000-3600,at/1000+3600],cloud_cover:[cloud,cloud]}},natural,at);
    const preview=createPreviewController(DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,720,{natural,safety:DEFAULT_SAFETY,data,date:'2026-06-21',now:at});
    const state=preview.snapshot();
    if(!renderer){renderer=new AquariumRenderer(canvas,state.preset);renderer.setSuspended(true);let seed=42;renderer.scenery=createScenery(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));}
    renderer.setLighting(state.preset);renderer.draw();
    const pixels=renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data;
    if(!clearPixels)clearPixels=new Uint8ClampedArray(pixels);
    let sum=0,delta=0,changed=0;
    for(let i=0;i<pixels.length;i+=4){for(let k=0;k<3;k++){sum+=pixels[i+k];delta+=Math.abs(pixels[i+k]-clearPixels[i+k]);}if([0,1,2].some(k=>pixels[i+k]!==clearPixels[i+k]))changed++;}
    const field=renderer.lighting.field,values=[];
    for(let i=0;i<field.data.length;i+=field.stride)values.push((field.data[i]+field.data[i+1]+field.data[i+2])/3);
    results.push({cloud:state.weather.cloud,receivedCloud:renderer.lighting.state.p.cloudCoverage,brightness:state.brightness,attenuation:state.weatherFactor,direct:renderer.lighting.state.direct,diffuse:renderer.lighting.state.ambient,fieldMin:Math.min(...values),fieldMax:Math.max(...values),pixelMean:sum/(pixels.length/4*3),pixelDelta:delta/(pixels.length/4*3),changedFraction:changed/(pixels.length/4),image:canvas.toDataURL()});
   }
   const boundaries=[];
   const {evaluateEnvironment}=await import('./js/environment.js');
   const time=[-2,-1,0,1,2].map(h=>at+h*3600000);
   const data=normalizeForecast({hourly:{time:time.map(t=>t/1000),cloud_cover:[5,80,20,95,40],weather_code:[0,95,0,95,0],direct_radiation:[600,0,500,0,300],diffuse_radiation:[100,300,100,300,100]}},natural,at);
   for(const epoch of time.slice(1,-1)){
    let before;const pair=[];
    for(const delta of [-100,100]){
     renderer.setLighting(evaluateEnvironment(epoch+delta,natural,DEFAULT_SAFETY,data,{now:at}).preset);renderer.draw();
     const pixels=renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data;
     pair.push(canvas.toDataURL());
     if(!before)before=new Uint8ClampedArray(pixels);
     else {let sum=0,max=0;for(let i=0;i<pixels.length;i++){const d=Math.abs(pixels[i]-before[i]);sum+=d;max=Math.max(max,d);}boundaries.push({epoch,meanDelta:sum/pixels.length,maxDelta:max,images:pair});}
    }
   }
   renderer.destroy();return {results,boundaries};
  });
  const {writeFileSync}=require('node:fs');
  for(const r of results){writeFileSync(`/tmp/aquaos-controlled-${r.cloud}.png`,Buffer.from(r.image.split(',')[1],'base64'));delete r.image;}
  for(const [i,b] of boundaries.entries()){
   b.images.forEach((img,j)=>writeFileSync(`/tmp/aquaos-boundary-${i}-${j}.png`,Buffer.from(img.split(',')[1],'base64')));delete b.images;
   assert(b.meanDelta<.05,`boundary mean pixel delta ${b.meanDelta}`);assert(b.maxDelta<=2);
  }
  console.log(JSON.stringify({results,boundaries},null,2));
  for(const [i,r] of results.entries()){assert.equal(r.cloud,[0,50,100][i]);assert.equal(r.receivedCloud,r.cloud/100);if(i){assert(r.direct<results[i-1].direct);assert(r.brightness<results[i-1].brightness);assert(r.pixelMean<results[i-1].pixelMean);assert(r.changedFraction>.9);assert(r.pixelDelta>1);}}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

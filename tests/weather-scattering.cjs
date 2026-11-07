const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce'});
  await page.goto(testUrl);
  const results=await page.evaluate(async()=>{
   const {AquariumRenderer}=await import('./js/renderer.js');
   const {calculateNaturalLighting,DEFAULT_NATURAL}=await import('./js/natural.js');
   const {DEFAULT_SAFETY}=await import('./js/safety.js');
   const {PREVIEW_WEATHER}=await import('./js/preview-weather.js');
   const {createScenery}=await import('./js/scenery.js');
   const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
   const at=Date.parse('2026-06-21T12:00Z'),n={...DEFAULT_NATURAL,latitude:0,longitude:0};
   const cycles=Object.fromEntries(['clear','partly-cloudy','cloudy','overcast'].map(name=>[name,calculateNaturalLighting(at,n,DEFAULT_SAFETY,null,{weatherOverride:PREVIEW_WEATHER[name]})]));
   cycles.night=calculateNaturalLighting(at+12*3600000,n,DEFAULT_SAFETY,null,{weatherOverride:PREVIEW_WEATHER.cloudy});
   cycles['diffuse-only']=calculateNaturalLighting(at,n,DEFAULT_SAFETY,null,{weatherOverride:{...PREVIEW_WEATHER.cloudy,directRadiation:0,diffuseRadiation:300}});
   const renderer=new AquariumRenderer(canvas,cycles.clear.preset);renderer.setSuspended(true);
   let seed=42;renderer.scenery=createScenery(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
   const results=[];
   for(const [name,cycle] of Object.entries(cycles)){
    const preset=cycle.preset;
    renderer.setLighting({...preset,shaftStrength:0});renderer.draw();
    const off=new Uint8ClampedArray(renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data);
    const offImage=canvas.toDataURL();
    renderer.setLighting(preset);renderer.draw();
    const on=renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const columns=new Array(canvas.width).fill(0);let sum=0,peak=0,changed=0,upper=0,lower=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const i=(y*canvas.width+x)*4,d=([0,1,2].reduce((s,k)=>s+Math.abs(on[i+k]-off[i+k]),0))/3;
     sum+=d;peak=Math.max(peak,d);if(d>0)changed++;
     if(y<canvas.height*.4){columns[x]+=d/Math.floor(canvas.height*.4);upper+=d;}
     if(y>canvas.height*.8)lower+=d;
    }
    results.push({name,strength:preset.shaftStrength,direct:preset.lighting.direct,transmissionFloor:preset.cloudTransmissionFloor,meanDelta:sum/(canvas.width*canvas.height),peakDelta:peak,changedFraction:changed/(canvas.width*canvas.height),columnContrast:Math.max(...columns)-Math.min(...columns),upperDelta:upper/(canvas.width*Math.floor(canvas.height*.4)),lowerDelta:lower/(canvas.width*Math.floor(canvas.height*.2)),image:canvas.toDataURL(),offImage});
   }
   renderer.destroy();canvas.remove();return results;
  });
  const {writeFileSync}=require('node:fs');
  for(const r of results){for(const [key,suffix] of [['image','on'],['offImage','off']]){writeFileSync(`/tmp/aquaos-scattering-${r.name}-${suffix}.png`,Buffer.from(r[key].split(',')[1],'base64'));delete r[key];}}
  console.log(JSON.stringify(results,null,2));
  for(const r of results){
   if(['partly-cloudy','cloudy'].includes(r.name)){
    assert(r.meanDelta>1,`${r.name}: scattering must survive pixel conversion`);
    assert(r.columnContrast>2,`${r.name}: openings must produce visible spatial contrast`);
    assert(r.peakDelta>5&&r.peakDelta<30,`${r.name}: visible but restrained scattering`);
    assert(r.upperDelta>r.lowerDelta*3,`${r.name}: scattering fades with optical depth`);
   }
   if(['overcast','night','diffuse-only'].includes(r.name))assert.equal(r.meanDelta,0,`${r.name}: no direct scattering`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

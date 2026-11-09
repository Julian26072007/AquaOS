const {launchBrowser,testUrl}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce'});
  await page.goto(testUrl);
  const results=await page.evaluate(async()=>{
   const {LightingPass}=await import('./js/effects.js');
   const {AquariumRenderer}=await import('./js/renderer.js');
   const {presets}=await import('./js/presets.js');
   const {evaluateManualLighting}=await import('./js/environment.js');
   const {OFF}=await import('./js/lighting.js');
   const preset=presets[0],at=Date.parse('2026-06-21T12:00Z');
   const canvas=document.createElement('canvas');canvas.style.cssText='width:354px;height:280px';document.body.append(canvas);
   const renderer=new AquariumRenderer(canvas,{preset,channels:OFF});renderer.setSuspended(true);
   const draw=output=>{renderer.setLighting(output);renderer.draw();return canvas.toDataURL();};
   const night=draw({preset,channels:OFF});
   const images=presets.map(p=>draw({preset:p,channels:evaluateManualLighting(p,at)}));
   const nightReplay=draw({preset:presets[4],channels:OFF});
   const display=new LightingPass();
   display.prepare(preset.channels);
   const colors=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>display.color('#ffffff',x,y));
   const noField=!('field' in renderer.lighting);
   renderer.destroy();
   return {images:new Set(images).size,nightReplay:night===nightReplay,nightVsDay:night!==images[0],colors:new Set(colors).size,noField};
  });
  assert.deepEqual(results,{images:9,nightReplay:true,nightVsDay:true,colors:1,noField:true});
  console.log('PASS: nine distinct global palettes, deterministic darkness and position-independent illumination.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

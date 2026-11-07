import {createCloudField} from './clouds.js';
import {createCaustics} from './caustics.js';
import {createLightning} from './timing.js';
export const rgb=(c,a=1)=>`rgba(${c.map(Math.round).join(',')},${a})`;
const mix=(a,b,k)=>a+(b-a)*k;

// Neutral scene material colors receive this same illumination at every depth.
// Values represent artistic radiance, not calibrated physical LED channels.
export class LightingEngine {
  constructor(seed=7319){this.clouds=createCloudField(seed);this.caustics=createCaustics(seed+13);this.lightning=createLightning(seed+37);}
  state(p,t,reduced=false){
    if(reduced)t=0;
    const config=p.lighting;
    let direct=config.direct;
    if(p.id==='sunrise')direct*=.35+.65*(1-Math.exp(-t/90));
    if(p.id==='sunset')direct*=.3+.7*Math.exp(-t/100);
    let tint=config.tint;
    if(p.id==='rainbow')tint=[0,2.094,4.189].map(phase=>.78+.17*Math.sin(t*.09+phase));
    return {p,t,ambient:config.ambient,direct,tint,flash:p.id==='storm'&&!reduced?this.lightning(t):0};
  }
  sample(state,x,y,aspect=1,out={}){
    const {p,t,ambient,direct,tint,flash}=state;
    // Back-project a slightly slanted sunlight direction through the water.
    const transmission=p.cloudDensity?this.clouds(x-y*.12,y*.8,t,p.cloudDensity):1;
    const attenuation=Math.exp(-y*.65);
    const sunlight=direct*transmission*attenuation;
    const caustic=this.caustics(x*aspect,y,t)*p.lighting.caustics*sunlight*(.3+y*.7);
    const sparkle=p.id==='sparkle'?Math.pow(this.caustics(x*aspect+27,y+39,t*.65),7)*.045*sunlight:0;
    const brightness=ambient+sunlight+caustic+sparkle;
    out.r=Math.min(1,brightness*tint[0]+flash*.85);
    out.g=Math.min(1,brightness*tint[1]+flash*.91);
    out.b=Math.min(1,brightness*tint[2]+flash);
    out.scattering=sunlight*.055*Math.exp(-y*2)+flash*.30;
    out.transmission=transmission;out.caustic=caustic;
    return out;
  }
}

// A tiny reusable radiance map is bilinearly enlarged by Canvas. It modulates
// the completed scene, including every fish, leaf and grain of substrate.
export class LightingPass {
  constructor(){
    this.engine=new LightingEngine();this.sampleA={};this.sampleB={};
    this.map=document.createElement('canvas');this.map.width=96;this.map.height=64;
    this.ctx=this.map.getContext('2d');this.pixels=this.ctx.createImageData(96,64);
    this.scatter=document.createElement('canvas');this.scatter.width=96;this.scatter.height=64;
    this.scatterCtx=this.scatter.getContext('2d');this.scatterPixels=this.scatterCtx.createImageData(96,64);
  }
  apply(ctx,w,h,p,previous,blend,t,reduced){
    const current=this.engine.state(p,t,reduced),old=blend<1?this.engine.state(previous,t,reduced):null;
    const data=this.pixels.data,fog=this.scatterPixels.data,aspect=Math.min(2,w/h);
    for(let y=0;y<64;y++)for(let x=0;x<96;x++){
      const a=this.engine.sample(current,x/95,y/63,aspect,this.sampleA);
      const b=old?this.engine.sample(old,x/95,y/63,aspect,this.sampleB):a;
      const i=(y*96+x)*4;
      data[i]=255*mix(b.r,a.r,blend);data[i+1]=255*mix(b.g,a.g,blend);data[i+2]=255*mix(b.b,a.b,blend);data[i+3]=255;
      const scattering=mix(b.scattering,a.scattering,blend);
      fog[i]=155;fog[i+1]=190;fog[i+2]=175;fog[i+3]=255*scattering;
    }
    this.ctx.putImageData(this.pixels,0,0);this.scatterCtx.putImageData(this.scatterPixels,0,0);
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.globalCompositeOperation='multiply';ctx.drawImage(this.map,0,0,w,h);
    ctx.globalCompositeOperation='screen';ctx.drawImage(this.scatter,0,0,w,h);ctx.restore();
  }
}

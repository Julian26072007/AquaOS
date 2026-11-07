import {createCloudField} from './clouds.js';
import {createCaustics} from './caustics.js';
import {createLightning} from './timing.js';
import {LightField} from './light-field.js';
export const rgb=(c,a=1)=>`rgba(${c.map(Math.round).join(',')},${a})`;

// World-space radiance is shared by scene materials at their tank positions.
// Values represent artistic radiance, not calibrated physical LED channels.
export const DEFAULT_ASSEMBLIES=Object.freeze([
  Object.freeze({id:'rear',y:.22,gain:1,rgb:Object.freeze([1,1,1]),warmWhite:.55,coolWhite:.45}),
  Object.freeze({id:'front',y:.78,gain:1,rgb:Object.freeze([1,1,1]),warmWhite:.42,coolWhite:.58}),
]);
export class LightingEngine {
  constructor(seed=7319){this.clouds=createCloudField(seed);this.caustics=createCaustics(seed+13);this.lightning=createLightning(seed+37);}
  state(p,t,reduced=false,assemblies=DEFAULT_ASSEMBLIES){
    if(reduced)t=0;
    const config=p.lighting;
    if(p.whiteBalance!==undefined)assemblies=assemblies.map(s=>{const warmWhite=Math.max(0,Math.min(1,p.whiteBalance+s.warmWhite-.48));return {...s,warmWhite,coolWhite:1-warmWhite};});
    if(p.rgbGain!==undefined)assemblies=assemblies.map(s=>({...s,rgb:s.rgb.map(value=>value*p.rgbGain)}));
    let direct=config.direct;
    if(p.id==='sunrise')direct*=.35+.65*(1-Math.exp(-t/90));
    if(p.id==='sunset')direct*=.3+.7*Math.exp(-t/100);
    let tint=config.tint;
    if(p.id==='rainbow')tint=[0,2.094,4.189].map(phase=>.78+.17*Math.sin(t*.09+phase));
    return {cloudMask:p.cloudDensity?this.clouds.prepare(t,p.cloudDensity):null,assemblies,p,t,ambient:config.ambient,direct,tint,flash:p.id==='storm'&&!reduced?this.lightning(t):0};
  }
  sample(state,x,y,aspect=1,out={}){
    const {p,t,ambient,direct,tint,flash}=state;
    // Broad, overlapping sources. y is tank depth; no vertical attenuation here.
    let red=0,green=0,blue=0,warmWhite=0,coolWhite=0,transmission=0,totalWeight=0;
    out.rear=0;out.front=0;
    for(const source of state.assemblies){
      const distance=y-source.y,weight=1-.28*distance*distance;
      const shade=state.cloudMask?state.cloudMask(x,y*.6+source.y*.4):1;
      // Diffuse overhead light keeps broad shadows instead of local spotlights.
      const trans=.18+.82*shade;
      const energy=direct*source.gain*weight*trans*.5;
      red+=energy*.35*source.rgb[0];green+=energy*.35*source.rgb[1];blue+=energy*.35*source.rgb[2];
      warmWhite+=energy*.65*source.warmWhite;
      coolWhite+=energy*.65*source.coolWhite;
      out[source.id]=energy;
      transmission+=weight*trans;totalWeight+=weight;
    }
    out.red=red*tint[0]+flash*.30;out.green=green*tint[1]+flash*.32;out.blue=blue*tint[2]+flash*.35;
    out.warmWhite=warmWhite;out.coolWhite=coolWhite+flash*.40;
    const caustic=this.caustics(x*aspect,y,t)*p.lighting.caustics*(red+warmWhite+coolWhite);
    const sparkle=p.id==='sparkle'?Math.pow(this.caustics(x*aspect+27,y+39,t*.65),7)*.025:0;
    out.r=Math.min(1,(ambient+red+warmWhite+coolWhite*.88+caustic+sparkle)*tint[0]+flash*.85);
    out.g=Math.min(1,(ambient+green+warmWhite*.91+coolWhite*.97+caustic+sparkle)*tint[1]+flash*.91);
    out.b=Math.min(1,(ambient+blue+warmWhite*.77+coolWhite+caustic+sparkle)*tint[2]+flash);
    out.scattering=(red+warmWhite+coolWhite)*.035+flash*.30;
    out.transmission=transmission/totalWeight;out.caustic=caustic;
    return out;
  }
}

// A top-down field is sampled at each object's world depth. z alone represents
// vertical distance below the surface. It never selects front/rear illumination.
export class LightingPass {
  constructor(){
    this.engine=new LightingEngine();this.field=new LightField();this.sampleA={};
    this.map=document.createElement('canvas');this.map.width=96;this.map.height=64;
    this.ctx=this.map.getContext('2d');this.pixels=this.ctx.createImageData(96,64);
    this.colors=new Map();this.attenuation=Float32Array.from({length:64},(_,i)=>Math.exp(-i/63*.28));
  }
  prepare(p,previous,blend,t,reduced){
    this.state=this.engine.state(p,t,reduced);this.old=this.engine.state(previous,t,reduced);this.blend=blend;
    this.field.update(this.engine,this.state,this.old,blend);
  }
  color(hex,x,y,z){
    let base=this.colors.get(hex);
    if(!base){const value=hex.slice(1);base=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16));base.push(value.length===8?parseInt(value.slice(6),16)/255:1);this.colors.set(hex,base);}
    const light=this.field.sample(x,y,this.sampleA,true),attenuation=Math.exp(-Math.max(0,z)*.28);
    return `rgba(${Math.round(base[0]*light.r*attenuation)},${Math.round(base[1]*light.g*attenuation)},${Math.round(base[2]*light.b*attenuation)},${base[3]})`;
  }
  gradient(ctx,hex,x,y,top,bottom,h){
    const g=ctx.createLinearGradient(0,top,0,bottom);
    g.addColorStop(0,this.color(hex,x,y,top/h));g.addColorStop(1,this.color(hex,x,y,bottom/h));return g;
  }
  applyWater(ctx,w,h,depth=.12,floor=false){
    const data=this.pixels.data;
    // The water/back wall is a rear plane. Screen height changes optical path
    // length (z), never the top-down field's y coordinate.
    for(let col=0;col<96;col++){
      let light=this.field.sample(col/95,depth,this.sampleA,true);
      // A fixed rear wall samples one depth per column. Only the clipped lower
      // floor needs perspective-varying depths; avoid shading invisible rows.
      for(let row=floor?54:0;row<64;row++){
        if(floor){const worldY=.65+Math.max(0,Math.min(1,(row/63-.91)/.09))*.35;light=this.field.sample(col/95,worldY,this.sampleA,true);}
        const attenuation=this.attenuation[row],i=(row*96+col)*4;
        data[i]=255*light.r*attenuation;data[i+1]=255*light.g*attenuation;data[i+2]=255*light.b*attenuation;data[i+3]=255;
      }
    }
    this.ctx.putImageData(this.pixels,0,0);ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.globalCompositeOperation='multiply';ctx.drawImage(this.map,0,0,w,h);
    // Low-energy, uniform scattering avoids bright radial/conical source masks.
    const flash=this.old.flash+(this.state.flash-this.old.flash)*this.blend;
    ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(155,190,175,${.012*Math.min(1,(this.state.ambient+this.state.direct)/.3)+flash*.3})`;ctx.fillRect(0,0,w,h);ctx.restore();
  }
}

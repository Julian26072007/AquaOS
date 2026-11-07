import {LightingPass,rgb} from './effects.js';
import {AnimationClock} from './timing.js';
import {createScenery,paintRocks,paintPlants,paintFish,paintBubbles} from './scenery.js';
export class AquariumRenderer {
  constructor(canvas,preset){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.preset=preset;this.previous=preset;
    this.scenery=createScenery();
    this.clock=new AnimationClock();this.lighting=new LightingPass();
    this.transition=1;this.frame=0;this.lastPaint=null;
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.tick=this.tick.bind(this);this.restart=this.restart.bind(this);
    this.observer=new ResizeObserver(()=>{this.resize();this.draw();});this.observer.observe(canvas);
    this.motion.addEventListener('change',this.restart);
    document.addEventListener('visibilitychange',this.restart);
    this.resize();this.restart();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx?.setTransform(d,0,0,d,0,0);}
  setPreset(p){this.previous=this.preset;this.preset=p;this.transition=this.motion.matches?1:0;this.canvas.setAttribute('aria-label',`${p.name}: ${p.description} Simulated aquarium lighting.`);this.draw();this.restart();}
  restart(){cancelAnimationFrame(this.frame);if(this.motion.matches)this.transition=1;this.clock.reset();this.lastPaint=null;if(!document.hidden){this.draw();if(!this.motion.matches)this.frame=requestAnimationFrame(this.tick);}}
  tick(now){
    const previous=this.clock.elapsed,t=this.clock.advance(now);
    this.transition=Math.min(1,this.transition+(t-previous)*2);
    if(this.lastPaint===null || now-this.lastPaint>=1000/30){this.draw();this.lastPaint=now;}
    this.frame=requestAnimationFrame(this.tick);
  }
  draw(){if(!this.ctx||!this.w||!this.h)return;const c=this.ctx,w=this.w,h=this.h,t=this.motion.matches?0:this.clock.elapsed;
    this.lighting.prepare(this.preset,this.previous,this.transition,t,this.motion.matches);
    c.clearRect(0,0,w,h);this.paintWater(this.previous,1);this.paintWater(this.preset,this.transition);this.lighting.applyWater(c,w,h);
    paintPlants(c,w,h,t,this.scenery,true,this.lighting);
    paintRocks(c,w,h,this.scenery,this.lighting);
    paintFish(c,w,h,t,this.scenery,this.lighting);
    paintPlants(c,w,h,t,this.scenery,false,this.lighting);
    const sand=c.createLinearGradient(0,h*.91,0,h);sand.addColorStop(0,'#4c5946');sand.addColorStop(1,'#202e29');c.fillStyle=sand;c.beginPath();c.moveTo(0,h*.95);c.bezierCurveTo(w*.3,h*.87,w*.6,h,w,h*.92);c.lineTo(w,h);c.lineTo(0,h);c.fill();c.save();c.clip();this.lighting.applyWater(c,w,h,.12,true);c.restore();
    for(let i=0;i<100;i++){c.fillStyle=this.lighting.color(i%2?'#a0a68130':'#0b242b44',(i*137%997)/997,.85,.95);c.fillRect((i*137%997)/997*w,h*(.95+(i*31%47)/1000),1.5,1);}
    // Fine suspended particles and a small school give scale without visual clutter.
    for(let i=0;i<24;i++){const x=((i*61.7+t*1.5)%997)/997*w,y=((i*113.3-t*2)%887+887)%887/887*h;c.fillStyle=this.lighting.color('#deefd63d',x/w,.5,y/h);c.beginPath();c.arc(x,y,i%3===0?1:.5,0,7);c.fill();}
    paintBubbles(c,w,h,t,this.scenery,this.lighting);
    const vignette=c.createRadialGradient(w*.5,h*.35,h*.1,w*.5,h*.5,w*.72);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#020e165c');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
  paintWater(p,alpha){
    const c=this.ctx,w=this.w,h=this.h;
    c.save();c.globalAlpha=alpha;
    const bg=c.createLinearGradient(0,0,w*.2,h);
    bg.addColorStop(0,rgb(p.top));bg.addColorStop(.5,rgb(p.bottom.map(v=>v*1.5)));bg.addColorStop(1,rgb(p.bottom));
    c.fillStyle=bg;c.fillRect(0,0,w,h);c.restore();
  }
  destroy(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.motion.removeEventListener('change',this.restart);document.removeEventListener('visibilitychange',this.restart);}
}

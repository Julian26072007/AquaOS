import {LightingPass} from './effects.js';
import {AnimationClock} from './timing.js';
import {createScenery,paintRocks,paintPlants,paintFish,paintBubbles} from './scenery.js';
export class AquariumRenderer {
  constructor(canvas,output){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.output=output;
    this.scenery=createScenery();
    this.clock=new AnimationClock();this.lighting=new LightingPass();
    this.frame=0;this.lastPaint=null;
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.tick=this.tick.bind(this);this.restart=this.restart.bind(this);
    this.observer=new ResizeObserver(()=>{this.resize();this.draw();});this.observer.observe(canvas);
    this.motion.addEventListener('change',this.restart);
    document.addEventListener('visibilitychange',this.restart);
    this.resize();this.restart();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx?.setTransform(d,0,0,d,0,0);}
  setLighting(output){
    this.output=output;
    const {name,description}=output.preset;
    const label=`${name}: ${description} Simulated aquarium lighting.`;
    if(this.canvas.getAttribute('aria-label')!==label)this.canvas.setAttribute('aria-label',label);
    if(this.motion.matches&&!this.suspended&&!document.hidden)this.draw();
  }
  setSuspended(value){this.suspended=value;if(value)cancelAnimationFrame(this.frame);else this.restart();}
  restart(){cancelAnimationFrame(this.frame);this.clock.reset();this.lastPaint=null;if(!document.hidden&&!this.suspended){this.draw();if(!this.motion.matches)this.frame=requestAnimationFrame(this.tick);}}
  tick(now){
    this.clock.advance(now);
    if(this.lastPaint===null || now-this.lastPaint>=1000/30){this.draw();this.lastPaint=now;}
    this.frame=requestAnimationFrame(this.tick);
  }
  draw(){if(!this.ctx||!this.w||!this.h)return;const c=this.ctx,w=this.w,h=this.h,t=this.motion.matches?0:this.clock.elapsed;
    this.lighting.prepare(this.output.channels);
    c.clearRect(0,0,w,h);this.paintWater();
    paintPlants(c,w,h,t,this.scenery,true,this.lighting);
    paintRocks(c,w,h,this.scenery,this.lighting);
    paintFish(c,w,h,t,this.scenery,this.lighting);
    paintPlants(c,w,h,t,this.scenery,false,this.lighting);
    const sand=c.createLinearGradient(0,h*.91,0,h);sand.addColorStop(0,this.lighting.color('#4c5946'));sand.addColorStop(1,this.lighting.color('#202e29'));c.fillStyle=sand;c.beginPath();c.moveTo(0,h*.95);c.bezierCurveTo(w*.3,h*.87,w*.6,h,w,h*.92);c.lineTo(w,h);c.lineTo(0,h);c.fill();
    for(let i=0;i<100;i++){c.fillStyle=this.lighting.color(i%2?'#a0a68130':'#0b242b44');c.fillRect((i*137%997)/997*w,h*(.95+(i*31%47)/1000),1.5,1);}
    // Fine suspended particles and a small school give scale without visual clutter.
    for(let i=0;i<24;i++){const x=((i*61.7+t*1.5)%997)/997*w,y=((i*113.3-t*2)%887+887)%887/887*h;c.fillStyle=this.lighting.color('#deefd63d');c.beginPath();c.arc(x,y,i%3===0?1:.5,0,7);c.fill();}
    paintBubbles(c,w,h,t,this.scenery,this.lighting);
    const vignette=c.createRadialGradient(w*.5,h*.35,h*.1,w*.5,h*.5,w*.72);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#020e165c');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
  paintWater(){
    const c=this.ctx,w=this.w,h=this.h;
    const bg=c.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,this.lighting.color('#b1d5c6'));
    bg.addColorStop(.5,this.lighting.color('#437b77'));
    bg.addColorStop(1,this.lighting.color('#133a3e'));
    c.fillStyle=bg;c.fillRect(0,0,w,h);
  }
  destroy(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.motion.removeEventListener('change',this.restart);document.removeEventListener('visibilitychange',this.restart);}
}

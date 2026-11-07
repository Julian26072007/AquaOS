import {sampleLight,rgb} from './effects.js';
export class AquariumRenderer {
  constructor(canvas,preset){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.preset=preset;this.previous=preset;
    this.elapsed=0;this.transition=1;this.last=0;this.frame=0;
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.tick=this.tick.bind(this);this.restart=this.restart.bind(this);
    this.observer=new ResizeObserver(()=>{this.resize();this.draw();});this.observer.observe(canvas);
    this.motion.addEventListener('change',this.restart);
    document.addEventListener('visibilitychange',this.restart);
    this.resize();this.restart();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx?.setTransform(d,0,0,d,0,0);}
  setPreset(p){this.previous=this.preset;this.preset=p;this.transition=this.motion.matches?1:.22;this.canvas.setAttribute('aria-label',`${p.name}: ${p.description} Simulated aquarium lighting.`);this.draw();this.restart();}
  restart(){cancelAnimationFrame(this.frame);this.last=0;if(!document.hidden){this.draw();if(!this.motion.matches)this.frame=requestAnimationFrame(this.tick);}}
  tick(now){if(this.last&&now-this.last<1000/30){this.frame=requestAnimationFrame(this.tick);return;}const dt=this.last?Math.min((now-this.last)/1000,.1):0;this.last=now;this.elapsed+=dt;this.transition=Math.min(1,this.transition+dt*2);this.draw();this.frame=requestAnimationFrame(this.tick);}
  draw(){if(!this.ctx||!this.w||!this.h)return;const c=this.ctx,w=this.w,h=this.h,t=this.motion.matches?0:this.elapsed;
    c.clearRect(0,0,w,h);this.paintWater(this.previous,t,1);this.paintWater(this.preset,t,this.transition);
    const light=sampleLight(this.preset,t,.5,this.motion.matches);
    // Distant rocks and gently swaying ribbon plants; stable seeded geometry.
    for(let i=0;i<11;i++){const x=(i*.137%1)*w,y=h*(.81+Math.sin(i*3)*.04);c.fillStyle=i%2?'#1b3935':'#233e38';c.beginPath();c.ellipse(x,y,w*(.045+(i%3)*.012),h*.1,-.3,0,Math.PI*2);c.fill();}
    for(let layer=0;layer<2;layer++)for(let i=0;i<34;i++){
      const x=((i*137+layer*47)%997)/997*w,base=h*(.97+layer*.03),height=h*(.13+((i*71)%101)/280)*(layer?1:.8);
      const sway=Math.sin(t*.45+i)*w*.009,tip=x+Math.sin(i*7)*w*.045+sway;
      c.fillStyle=layer?`rgba(35,83,57,${.85})`:'#34624b';c.beginPath();c.moveTo(x-3,base);c.bezierCurveTo(x-18,base-height*.4,tip-8,base-height*.8,tip,base-height);c.bezierCurveTo(tip+6,base-height*.6,x+10,base-height*.3,x+3,base);c.fill();
    }
    const sand=c.createLinearGradient(0,h*.91,0,h);sand.addColorStop(0,'#4c5946');sand.addColorStop(1,'#202e29');c.fillStyle=sand;c.beginPath();c.moveTo(0,h*.95);c.bezierCurveTo(w*.3,h*.87,w*.6,h,w,h*.92);c.lineTo(w,h);c.lineTo(0,h);c.fill();
    for(let i=0;i<100;i++){c.fillStyle=i%2?'#a0a68130':'#0b242b44';c.fillRect((i*137%997)/997*w,h*(.95+(i*31%47)/1000),1.5,1);}
    // Fine suspended particles and a small school give scale without visual clutter.
    c.fillStyle='#deefd63d';for(let i=0;i<24;i++){const x=((i*61.7+t*1.5)%997)/997*w,y=((i*113.3-t*2)%887+887)%887/887*h;c.beginPath();c.arc(x,y,i%3===0?1:.5,0,7);c.fill();}
    for(let i=0;i<5;i++){const x=w*(.36+i*.065+Math.sin(t*.12)*.06),y=h*(.54+Math.sin(i*3)*.055);c.fillStyle='#a9c0a875';c.beginPath();c.ellipse(x,y,w*.012,h*.008,0,0,7);c.moveTo(x-w*.01,y);c.lineTo(x-w*.02,y-h*.009);c.lineTo(x-w*.02,y+h*.009);c.fill();}
    // Tint the entire scene so plants and substrate also respond to the chosen light.
    c.fillStyle=rgb(light.top,.12);c.fillRect(0,0,w,h);
    c.fillStyle=`rgba(2,8,19,${(1-this.preset.brightness)*.55})`;c.fillRect(0,0,w,h);
    const vignette=c.createRadialGradient(w*.5,h*.35,h*.1,w*.5,h*.5,w*.72);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#020e165c');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
  paintWater(p,t,alpha){const c=this.ctx,w=this.w,h=this.h,L=sampleLight(p,t,.5,this.motion.matches);c.save();c.globalAlpha=alpha;
    const bg=c.createLinearGradient(0,0,w*.2,h);bg.addColorStop(0,rgb(L.top));bg.addColorStop(.5,rgb(L.bottom.map(v=>v*1.5)));bg.addColorStop(1,rgb(L.bottom));c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.globalCompositeOperation='screen';
    for(let i=0;i<12;i++){const l=sampleLight(p,t,i/12,this.motion.matches),x=w*(i/11+Math.sin(l.time+i)*.025);const beam=c.createLinearGradient(x,0,x+w*.12,h);beam.addColorStop(0,rgb(l.top,.24*l.shade));beam.addColorStop(1,rgb(l.top,0));c.fillStyle=beam;c.beginPath();c.moveTo(x-w*.025,0);c.lineTo(x+w*.025,0);c.lineTo(x+w*.22,h);c.lineTo(x-w*.07,h);c.fill();}
    c.globalCompositeOperation='source-over';
    if(p.cloudDensity)for(let i=0;i<3;i++){const x=((i*.44+L.time*.035)%1.8-.4)*w;const g=c.createRadialGradient(x,0,0,x,h*.12,w*.48);g.addColorStop(0,`rgba(4,12,26,${p.cloudDensity*.55})`);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,w,h);}
    if(p.id==='waves'||p.id==='sunny'){c.strokeStyle=rgb(L.top,p.id==='waves'?.22:.07);c.lineWidth=1;for(let i=0;i<15;i++){c.beginPath();for(let x=0;x<=w;x+=8){const y=h*(.15+i*.055)+Math.sin(x*.025+L.time*2+i)*h*.018;c.lineTo(x,y);}c.stroke();}}
    if(p.id==='sparkle'){for(let i=0;i<22;i++){const a=(.5+.5*Math.sin(L.time*2+i*2.4))**12;c.fillStyle=rgb([228,239,198],a*.65);const x=(i*137%991)/991*w,y=(i*73%751)/751*h;c.fillRect(x-2,y,5,1);c.fillRect(x,y-2,1,5);}}
    if(L.flash){c.fillStyle=rgb([210,225,255],L.flash*.3);c.fillRect(0,0,w,h);c.strokeStyle=rgb([227,238,255],L.flash);c.lineWidth=1.5;c.beginPath();c.moveTo(w*.72,0);c.lineTo(w*.68,h*.14);c.lineTo(w*.73,h*.13);c.lineTo(w*.65,h*.31);c.stroke();}
    c.restore();
  }
  destroy(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.motion.removeEventListener('change',this.restart);document.removeEventListener('visibilitychange',this.restart);}
}

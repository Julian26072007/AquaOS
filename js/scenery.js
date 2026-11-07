// Generate once per page load, never per frame. Normalized coordinates preserve
// the aquascape on resize; fish sizes use the shorter edge to avoid stretching.
export function createScenery(random=Math.random) {
  const range=(a,b)=>a+random()*(b-a);
  const scene={
    rocks:Array.from({length:9},()=>({x:random(),y:range(.83,.93),size:range(.05,.13),tilt:range(-.7,.7)})),
    plants:Array.from({length:48},(_,i)=>({
      x:random(),height:range(.24,.76),width:range(.7,1.5),phase:range(0,Math.PI*2),
      type:i%3,back:i<24,shade:Math.floor(range(0,3)),
    })),
    fish:Array.from({length:12},(_,i)=>({
      phase:range(0,Math.PI*2),speed:range(.09,.19),y:range(.19,.69),
      size:range(.018,.032),school:i<7,type:i%3,depth:range(.65,1),
    })),
    bubbles:Array.from({length:13},()=>({x:random(),y:random(),size:range(.7,1.8),speed:range(.018,.035)})),
  };
  // World depth is explicit metadata, independent of vertical screen position.
  // Derive it without consuming more random values, preserving the artwork seed.
  scene.rocks.forEach(r=>r.worldY=.3+Math.abs(r.tilt)*.7);
  scene.plants.forEach(p=>p.worldY=(p.back?.12:.7)+p.phase/(Math.PI*2)*.17);
  scene.fish.forEach(f=>f.worldY=(f.depth-.65)/.35);
  scene.bubbles.forEach(b=>b.worldY=.45);
  return scene;
}

export function paintRocks(c,w,h,scene,lighting){
  for(const r of scene.rocks){
    const x=r.x*w,y=r.y*h,size=r.size*Math.min(w,h);
    const g=c.createLinearGradient(x-size,y-size,x+size,y+size);
    const depth=r.worldY;
    g.addColorStop(0,lighting.color('#526055',r.x,depth,(y-size)/h));g.addColorStop(1,lighting.color('#162f2b',r.x,depth,(y+size)/h));c.fillStyle=g;
    c.beginPath();c.ellipse(x,y,size*1.4,size,r.tilt,0,Math.PI*2);c.fill();
  }
}

export function paintPlants(c,w,h,t,scene,back,lighting){
  const unit=Math.min(w,h);
  for(const p of scene.plants){
    if(p.back!==back)continue;
    // Tall growth at the edges leaves a swimming corridor through the center.
    const edge=Math.abs(p.x-.5)*2;
    const height=h*p.height*(.55+edge*.45),base=h*.95,x=p.x*w;
    const sway=Math.sin(t*.55+p.phase)*unit*.014;
    const tip=x+sway+Math.sin(p.phase)*unit*.04;
    c.save();c.globalAlpha=back?.58:.95;
    const material=(back?['#326451','#39654b','#2c594c']:['#3d7954','#568452','#28694e'])[p.shade];
    const depth=p.worldY;
    c.fillStyle=lighting.gradient(c,material,p.x,depth,base-height,base,h);
    c.strokeStyle=c.fillStyle;
    if(p.type===0){
      // Long vallisneria ribbons.
      const width=unit*.009*p.width;
      c.beginPath();c.moveTo(x-width,base);
      c.bezierCurveTo(x-unit*.04,base-height*.4,tip-width,base-height*.85,tip,base-height);
      c.bezierCurveTo(tip+width,base-height*.7,x+unit*.025,base-height*.35,x+width,base);c.fill();
    } else if(p.type===1){
      // Stem plants with alternating paired leaves.
      c.lineWidth=Math.max(1,unit*.003);c.beginPath();c.moveTo(x,base);c.quadraticCurveTo(x+sway*.2,base-height*.5,tip,base-height);c.stroke();
      for(let j=1;j<9;j++){
        const k=j/9,y=base-height*k,cx=x+(tip-x)*k*k,side=j%2?1:-1;
        const leaf=unit*.035*p.width*(1-k*.65);
        c.beginPath();c.moveTo(cx,y);c.quadraticCurveTo(cx+side*leaf,y-leaf*.9,cx+side*leaf*1.2,y-leaf*.55);c.quadraticCurveTo(cx+side*leaf*.5,y+leaf*.2,cx,y);c.fill();
      }
    } else {
      // Broad cryptocoryne leaves in shorter foreground clusters.
      for(let j=0;j<3;j++){
        const end=x+(j-1)*unit*.055+sway,top=base-height*(.5+j*.12),breadth=unit*.018*p.width;
        c.beginPath();c.moveTo(x,base);c.bezierCurveTo(x-breadth,top+height*.15,end-breadth,top,end,top);c.bezierCurveTo(end+breadth,top+height*.12,x+breadth,base-height*.12,x,base);c.fill();
      }
    }
    c.restore();
  }
}

export function paintFish(c,w,h,t,scene,lighting){
  const unit=Math.min(w,h);
  for(let i=0;i<scene.fish.length;i++){
    const f=scene.fish[i];
    // Shared school trajectory with individual offsets; other fish explore alone.
    const phase=t*(f.school?.13:f.speed)+(f.school?i*.12:f.phase);
    const x=w*(.5+.39*Math.sin(phase)),direction=Math.cos(phase)>=0?1:-1;
    const y=h*(f.y+Math.sin(t*.45+f.phase)*.025);
    const size=unit*f.size*f.depth;
    // Narrow briefly at turns, rather than teleporting across the tank.
    const turn=.3+.7*Math.min(1,Math.abs(Math.cos(phase))*5);
    c.save();c.translate(x,y);c.scale(direction*turn,1);c.globalAlpha=.55+f.depth*.4;
    const palettes=[['#81c6c0','#d97b65'],['#d7b66f','#c78148'],['#b1c9b2','#789b84']];
    const depth=f.worldY; // independent of the fish's screen height
    const lit=hex=>lighting.color(hex,x/w,depth,y/h);
    const [body,tail]=palettes[f.type].map(lit);const beat=Math.sin(t*7+f.phase);
    c.fillStyle=tail;c.beginPath();c.moveTo(-size*.65,0);c.lineTo(-size*(1.3+beat*.08),-size*.38);c.quadraticCurveTo(-size*(1.1-beat*.1),0,-size*1.3,size*.38);c.closePath();c.fill();
    c.fillStyle=body;c.beginPath();c.ellipse(0,0,size,size*(f.type===1?.48:.32),0,0,Math.PI*2);c.fill();
    c.fillStyle=tail;c.globalAlpha*=.65;c.beginPath();c.moveTo(-size*.3,-size*.22);c.lineTo(0,-size*.62);c.lineTo(size*.45,-size*.2);c.fill();
    if(f.type===0){c.strokeStyle=lit('#b6f0e9');c.lineWidth=Math.max(.6,size*.12);c.beginPath();c.moveTo(-size*.6,-size*.02);c.lineTo(size*.5,-size*.02);c.stroke();}
    c.globalAlpha=1;c.fillStyle=lit('#112729');c.beginPath();c.arc(size*.62,-size*.08,Math.max(.65,size*.09),0,7);c.fill();c.restore();
  }
}

export function paintBubbles(c,w,h,t,scene,lighting){
  c.lineWidth=.7;
  for(const b of scene.bubbles){const y=1-((b.y+t*b.speed)%1),x=b.x*w+Math.sin(t+b.y*20)*3;c.strokeStyle=lighting.color('#daeee137',x/w,b.worldY,y);c.beginPath();c.arc(x,y*h,b.size,0,Math.PI*2);c.stroke();}
}

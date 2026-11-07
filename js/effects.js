const mix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
export const rgb=(c,a=1)=>`rgba(${c.map(Math.round).join(',')},${a})`;
export function sampleLight(p,t,x=.5,reduced=false){
  const time=reduced?0:t*p.speed;
  let top=p.top, bottom=p.bottom;
  if(p.id==='rainbow'){
    const hue=time*.3;
    top=[0,2,4].map(n=>105+70*Math.sin(hue+n));
    bottom=top.map(v=>v*.23);
  }
  let shade=1;
  if(p.cloudDensity)shade=1-p.cloudDensity*(.5+.25*Math.sin(x*8-time)+.2*Math.sin(x*15-time*.7));
  const ripple=.5+.5*Math.sin(x*22+time*2);
  // Sparse, soft double pulses, at least 10 seconds apart. Disabled for reduced motion.
  const phase=t%13;
  const flash=p.id==='storm'&&!reduced ? Math.max(0,1-Math.abs(phase-8.1)/.14)*.5+Math.max(0,1-Math.abs(phase-8.48)/.2)*.35 : 0;
  return {top:mix(top,[207,222,244],flash),bottom,shade,ripple,time,flash};
}

import {createNoise,smoothstep} from './noise.js';
export function createCloudField(seed=7319){
  const noise=createNoise(seed);
  function fbm(x,y){return noise(x,y)*.58+noise(x*2.03+19,y*2.03+7)*.28+noise(x*4.11+43,y*4.11+31)*.14;}
  const sample=(x,y,t,density=.65)=>{
    // Drift in both overhead axes over roughly 100–150 seconds. Independent high layer and a slow
    // coverage envelope deform the field without reseeding or frame randomness.
    const drift=t*.023, depthDrift=t*.011;
    const warp=noise(x*.8+12-drift*.25,y*.6+35-depthDrift*.3)*.65;
    const low=fbm(x*2.4-drift+warp+17,y*1.7+23-depthDrift);
    const high=fbm(x*1.5-drift*.63+73,y*1.2-depthDrift*.71+81);
    const coverage=noise(t*.003+51,4)*.12;
    const thickness=smoothstep(.30,.70,low*.75+high*.25+coverage-.06);
    // Transmittance, not a painted cloud: only the direct term is blocked.
    return Math.exp(-thickness*density*3.8);
  };
  // Build broad cloud masks at reduced resolution, independently of the scene
  // and output field. Cached closures also keep two transition presets stable.
  const cache=[];
  sample.prepare=(t,density)=>{
    let entry;
    return (x,y)=>{
      if(x<0||x>1||y<0||y>1)return sample(x,y,t,density);
      if(!entry){
        entry=cache.find(e=>e.t===t&&e.density===density);
        if(!entry){
          const values=new Float32Array(40*24);
          for(let row=0;row<24;row++)for(let col=0;col<40;col++)values[row*40+col]=sample(col/39,row/23,t,density);
          entry={t,density,values};cache.push(entry);if(cache.length>4)cache.shift();
        }
      }
      const px=x*39,py=y*23,ix=Math.min(38,Math.floor(px)),iy=Math.min(22,Math.floor(py)),fx=px-ix,fy=py-iy;
      const i=iy*40+ix,v=entry.values;
      const a=v[i]+(v[i+1]-v[i])*fx,b=v[i+40]+(v[i+41]-v[i+40])*fx;
      return a+(b-a)*fy;
    };
  };
  return sample;
}

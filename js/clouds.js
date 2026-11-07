import {createNoise,smoothstep} from './noise.js';
export function createCloudField(seed=7319){
  const noise=createNoise(seed);
  function fbm(x,y){return noise(x,y)*.58+noise(x*2.03+19,y*2.03+7)*.28+noise(x*4.11+43,y*4.11+31)*.14;}
  return (x,y,t,density=.65)=>{
    // Cross one tank in ~85 seconds. Independent high layer and a slow
    // coverage envelope deform the field without reseeding or frame randomness.
    const drift=t*.028;
    const warp=noise(x*.8+12-drift*.25,y*.6+35)*.65;
    const low=fbm(x*2.4-drift+warp+17,y*1.7+23);
    const high=fbm(x*1.5-drift*.63+73,y*1.2+t*.0015+81);
    const coverage=noise(t*.003+51,4)*.12;
    const thickness=smoothstep(.30,.70,low*.75+high*.25+coverage-.06);
    // Transmittance, not a painted cloud: only the direct term is blocked.
    return Math.exp(-thickness*density*3.8);
  };
}

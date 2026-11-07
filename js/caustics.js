import {createNoise} from './noise.js';
export function createCaustics(seed=9182){
  const noise=createNoise(seed);
  return (x,y,t)=>{
    const warp=noise(x*3+t*.09,y*3-t*.07);
    const a=noise(x*11+warp*1.7+t*.13,y*9+t*.08);
    const b=noise(x*8+31-t*.09,y*12+17+t*.11);
    // Fine irregular, refracted highlights. No animated lines or polygons.
    const ridge=Math.max(0,1-Math.abs(a-b)*10);
    return ridge*ridge*ridge;
  };
}

// Cached lattice values; interpolation is continuous in space and time.
// A 256-cell period is many hours of cloud travel, not a short animation loop.
export function createNoise(seed=7319) {
  const values=new Float32Array(256*256);
  let state=seed>>>0;
  for(let i=0;i<values.length;i++){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    values[i]=state/4294967296;
  }
  const smooth=t=>t*t*t*(t*(t*6-15)+10);
  return (x,y)=>{
    const ix=Math.floor(x),iy=Math.floor(y),sx=smooth(x-ix),sy=smooth(y-iy);
    const a=values[((iy&255)<<8)+(ix&255)],b=values[((iy&255)<<8)+((ix+1)&255)];
    const c=values[(((iy+1)&255)<<8)+(ix&255)],d=values[(((iy+1)&255)<<8)+((ix+1)&255)];
    return a+(b-a)*sx+(c-a+(d-c-b+a)*sx)*sy;
  };
}
export const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

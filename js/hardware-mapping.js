// Pure field reduction. No networking, pin mapping, voltages or driver protocol.
const CHANNELS=Object.freeze(['red','green','blue','warmWhite','coolWhite']);
export const UNIFORM_CAPABILITIES=Object.freeze([
  Object.freeze({id:'rear',bounds:Object.freeze({x0:0,x1:1,y0:0,y1:.5}),segments:Object.freeze({red:1,green:1,blue:1,warmWhite:1,coolWhite:1})}),
  Object.freeze({id:'front',bounds:Object.freeze({x0:0,x1:1,y0:.5,y1:1}),segments:Object.freeze({red:1,green:1,blue:1,warmWhite:1,coolWhite:1})}),
]);
/** segments: 0 = unavailable, 1 = uniform, N = left-to-right addressable zones.
 * RGB channels can share the same N; white channels can independently stay at 1.
 * Explicit bounds are tank-space footprints, not screen coordinates.
 */
export function mapLightField(field,capabilities=UNIFORM_CAPABILITIES){
  if(!Array.isArray(capabilities)||!capabilities.length)throw new TypeError('Assembly capabilities are required');
  const ids=new Set(),sample={};
  return capabilities.map(assembly=>{
    if(!assembly.id||ids.has(assembly.id))throw new TypeError('Assembly IDs must be unique');ids.add(assembly.id);
    const b=assembly.bounds;
    if(!b||![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite)||b.x0<0||b.y0<0||b.x1>1||b.y1>1||b.x0>=b.x1||b.y0>=b.y1)throw new RangeError('Invalid tank footprint');
    const channels={};
    for(const channel of CHANNELS){
      const count=assembly.segments?.[channel]??0;
      if(!Number.isInteger(count)||count<0||count>field.width)throw new RangeError('Invalid channel segment count');
      const values=[];
      for(let zone=0;zone<count;zone++){
        const left=b.x0+(b.x1-b.x0)*zone/count,right=b.x0+(b.x1-b.x0)*(zone+1)/count;
        // Cell-centered quadrature averages the whole footprint, never a single
        // center pixel. This anti-aliases clouds into uniform or segmented bars.
        const nx=Math.max(2,Math.ceil((right-left)*field.width)),ny=Math.max(2,Math.ceil((b.y1-b.y0)*field.height));
        let total=0;
        for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
          const value=field.sample(left+(x+.5)/nx*(right-left),b.y0+(y+.5)/ny*(b.y1-b.y0),sample)[channel];
          if(!Number.isFinite(value))throw new TypeError('Invalid field channel');
          total+=value;
        }
        values.push(Math.max(0,Math.min(1,total/(nx*ny))));
      }
      channels[channel]=values;
    }
    return {id:assembly.id,channels};
  });
}

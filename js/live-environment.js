import {evaluateEnvironment} from './environment.js';

const duration=60000;
const ease=x=>{const k=Math.max(0,Math.min(1,x));return k*k*(3-2*k);};
// Transition only the visual shape on data replacement. Brightness and darkness
// still belong to the real-output safety controller. Motion has its own anchor;
// it must never return to an unrelated trajectory as a transition finishes.
const fields=['cloudDensity','cloudCoverage','cloudTransmissionFloor','shaftStrength','whiteBalance','rgbGain'];
function shape(c){
  const p=c.preset;
  return [...fields.map(k=>p[k]??0),...p.top,...p.bottom,...p.lighting.tint,p.lighting.caustics,
    c.brightness>0?p.lighting.ambient/c.brightness:.44,c.brightness>0?p.lighting.direct/c.brightness:.68];
}
function withShape(c,values,motion){
  const p=c.preset;let i=0;
  const properties=Object.fromEntries(fields.map(k=>[k,Math.max(0,Math.min(k==='cloudDensity'?3:1,values[i++]))]));
  const take=(count,max)=>Array.from({length:count},()=>Math.max(0,Math.min(max,values[i++])));
  const top=take(3,255),bottom=take(3,255),tint=take(3,1.5),caustics=take(1,1)[0];
  const environment={...c.environment,cloudMotion:motion};
  return {...c,environment,preset:{...p,...properties,top,bottom,cloudMotion:motion,environment,
    lighting:{...p.lighting,tint,caustics,ambient:Math.max(0,values[i++])*c.brightness,direct:Math.max(0,values[i++])*c.brightness}}};
}
/** Live-only acquisition continuity. Pure evaluation (including preview) stays
 * history independent. Corrections use absolute elapsed time, not render count.
 * Old/new forecasts are evaluated at the SAME time before forming an offset.
 */
export function createLiveEnvironmentEvaluator(){
  let previous=null,offset=null,started=0,motionOffset={x:0,y:0};
  const apply=(target,epoch)=>{
    const weight=1-ease((epoch-started)/duration),values=shape(target).map((v,i)=>v+(offset?.[i]??0)*weight);
    const motion={x:target.preset.cloudMotion.x+motionOffset.x,y:target.preset.cloudMotion.y+motionOffset.y};
    return withShape(target,values,motion);
  };
  return (epoch,natural,safety,data)=>{
    const target=evaluateEnvironment(epoch,natural,safety,data,{now:epoch,current:true});
    const revision=JSON.stringify([data?.hourly,data?.daily,data?.current]);
    const key=JSON.stringify([natural,safety]),estimated=target.weather.source==='estimated';
    if(previous&&previous.key===key&&(revision!==previous.revision||estimated!==previous.estimated)){
      // On expiry retain the last valid shape rather than re-evaluating an
      // already expired forecast as fallback. Missing/returning data is anchored too.
      const old=estimated!==previous.estimated?previous.output:apply(evaluateEnvironment(epoch,natural,safety,previous.data,{now:epoch,current:true}),epoch);
      const a=shape(old),b=shape(target);offset=a.map((v,i)=>v-b[i]);started=epoch;
      motionOffset={x:old.preset.cloudMotion.x-target.preset.cloudMotion.x,y:old.preset.cloudMotion.y-target.preset.cloudMotion.y};
    }else if(!previous||previous.key!==key){offset=null;motionOffset={x:0,y:0};}
    const output=apply(target,epoch);
    previous={data,revision,key,estimated,output};return output;
  };
}

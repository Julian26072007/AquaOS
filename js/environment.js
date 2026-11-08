import {calculateNaturalLighting} from './natural.js';
import {calculateLightingAtTime} from './schedule.js';

const withTime=(cycle,epoch)=>({...cycle,preset:{...cycle.preset,environmentTime:(epoch-Date.UTC(2020,0,1))/360000}});

export function evaluateScheduledEnvironment(time,schedule,settings,epoch){
  return withTime(calculateLightingAtTime(time,schedule,settings),epoch);
}

/** Pure environmental target, shared by live and preview clocks. Pattern time
 * has a fixed epoch and rate: no frame history, date reset or playback input.
 * The renderer owns the deterministic procedural seed (LightingEngine).
 * Real-output safety/slew belongs to the controller/hardware gate, never here.
 */
export function evaluateEnvironment(epoch,natural,safety,data=null,options={}){
  if(!Number.isFinite(epoch))throw new Error('Invalid environment timestamp');
  const cycle=calculateNaturalLighting(epoch,natural,safety,data,{current:true,...options});
  return withTime(cycle,epoch);
}

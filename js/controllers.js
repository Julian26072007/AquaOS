import {calculateLightingAtTime,localMinutes,validateSchedule} from './schedule.js';
import {getPreset} from './presets.js';
/** Only this controller may feed a future hardware subscriber. Its real clock
 * is private and has no setter. Preview has no reference to this controller. */
export function createRealLightingController(store,now=()=>new Date()){
  const listeners=new Set();let output;
  return {
    sample(){
      const state=store.getState(),at=now();
      const cycle=state.mode==='automatic'?calculateLightingAtTime(at,state.schedule,state.cycleSettings):null;
      output=Object.freeze({source:'real',at:at.getTime(),mode:state.mode,preset:cycle?.preset||getPreset(state.presetId),cycle});
      listeners.forEach(fn=>fn(output));return output;
    },
    getOutput:()=>output,
    subscribeRealOutput(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  };
}
/** Simulation-only clock. No persistence or hardware callback is accepted. */
export function createPreviewController(schedule,settings,minutes=localMinutes(new Date())){
  validateSchedule(schedule,settings);if(!Number.isFinite(minutes))throw new Error('Invalid preview time');
  schedule=Object.freeze({...schedule});settings=Object.freeze({...settings});
  let time=((minutes%1440)+1440)%1440,playing=false,speed=360;
  return {
    snapshot:()=>({source:'preview',minutes:time,playing,speed,...calculateLightingAtTime(time,schedule,settings)}),
    scrub(value){if(!Number.isFinite(value))throw new Error('Invalid preview time');time=((value%1440)+1440)%1440;},
    setPlaying(value){playing=Boolean(value);},
    setSpeed(value){if(![60,360,1440].includes(value))throw new Error('Invalid preview speed');speed=value;},
    advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid preview interval');if(playing)time=(time+seconds*speed/60)%1440;},
  };
}

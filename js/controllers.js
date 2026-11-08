import {localMinutes,validateSchedule} from './schedule.js';
import {PREVIEW_WEATHER} from './preview-weather.js';
import {getPreset} from './presets.js';
import {evaluateEnvironment,evaluateScheduledEnvironment} from './environment.js';
import {createNaturalRuntimeSafety} from './safety.js';
import {locationKey} from './weather.js';
import {zonedParts,epochForZoned} from './astronomy.js';
/** Only this controller may feed a future hardware subscriber. Its real clock
 * is private and has no setter. Preview has no reference to this controller. */
export function createRealLightingController(store,now=()=>new Date(),environment=()=>({data:null,status:'offline'})){
  const listeners=new Set(),runtimeSafety=createNaturalRuntimeSafety();let output,previousNatural=null;
  return {
    sample(){
      const state=store.getState(),at=now();
      let cycle=state.mode==='automatic'?evaluateScheduledEnvironment(at,state.schedule,state.cycleSettings,at.getTime()):null;
      if(state.mode==='natural'){
        const snapshot=environment(),data=snapshot.data?.key===locationKey(state.natural)?snapshot.data:null;
        const target=evaluateEnvironment(at.getTime(),state.natural,state.safety,data,{now:at.getTime(),current:true});
        cycle=runtimeSafety(target,previousNatural,at.getTime(),state.natural,state.safety);cycle.weatherStatus=snapshot.status;
        previousNatural=cycle;
      }else{previousNatural=null;}
      output=Object.freeze({source:'real',at:at.getTime(),mode:state.mode,preset:cycle?.preset||getPreset(state.presetId),cycle});
      listeners.forEach(fn=>fn(output));return output;
    },
    getOutput:()=>output,
    subscribeRealOutput(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  };
}
/** Simulation-only clock. No persistence or hardware callback is accepted. */
export function createPreviewController(schedule,settings,minutes=localMinutes(new Date()),naturalContext=null){
  validateSchedule(schedule,settings);if(!Number.isFinite(minutes))throw new Error('Invalid preview time');
  schedule=Object.freeze({...schedule});settings=Object.freeze({...settings});
  const context=naturalContext?{...naturalContext,natural:Object.freeze({...naturalContext.natural}),safety:Object.freeze({...naturalContext.safety}),data:naturalContext.data?JSON.parse(JSON.stringify(naturalContext.data)):null}:null;
  let previewDate=context?.date,weatherOverride=null;
  let time=((minutes%1440)+1440)%1440,playing=false,speed=360;
  const today=new Date();today.setHours(0,0,0,0);
  let patternDay=0;
  return {
    snapshot:()=>{
      const cycle=context?evaluateEnvironment(epochForZoned(previewDate,time,context.natural.timezone),context.natural,context.safety,context.data,{now:context.now,weatherOverride}):evaluateScheduledEnvironment(time,schedule,settings,today.getTime()+(patternDay*1440+time)*60000);
      return {source:'preview',playing,speed,...cycle,minutes:time,date:previewDate};
    },
    setWeatherOverride(name=null){if(!context)throw new Error('Weather simulation requires Natural preview');if(name!==null&&!Object.hasOwn(PREVIEW_WEATHER,name))throw new Error('Invalid preview weather');weatherOverride=name===null?null:PREVIEW_WEATHER[name];},
    resetNow(epoch=Date.now()){if(context){const at=zonedParts(epoch,context.natural.timezone);previewDate=at.date;time=at.minutes;}else {time=localMinutes(new Date(epoch));today.setTime(epoch);today.setHours(0,0,0,0);patternDay=0;}},
    setDate(date){if(!context||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid preview date');previewDate=date;},
    scrub(value){if(!Number.isFinite(value))throw new Error('Invalid preview time');time=((value%1440)+1440)%1440;},
    setPlaying(value){playing=Boolean(value);},
    setSpeed(value){if(![60,360,1440,3600].includes(value))throw new Error('Invalid preview speed');speed=value;},
    advance(seconds){
      if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid preview interval');
      if(playing){
        if(context){const at=zonedParts(epochForZoned(previewDate,time,context.natural.timezone)+seconds*speed*1000,context.natural.timezone);previewDate=at.date;time=at.minutes;}
        else {const next=time+seconds*speed/60;patternDay+=Math.floor(next/1440);time=next%1440;}
      }
    },
  };
}

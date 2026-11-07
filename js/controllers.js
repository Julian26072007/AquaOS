import {calculateLightingAtTime,localMinutes,validateSchedule} from './schedule.js';
import {PREVIEW_WEATHER} from './preview-weather.js';
import {getPreset} from './presets.js';
import {calculateNaturalLighting} from './natural.js';
import {createNaturalRuntimeSafety} from './safety.js';
import {weatherAt,smoothWeather,locationKey} from './weather.js';
import {zonedParts,epochForZoned} from './astronomy.js';
/** Only this controller may feed a future hardware subscriber. Its real clock
 * is private and has no setter. Preview has no reference to this controller. */
export function createRealLightingController(store,now=()=>new Date(),environment=()=>({data:null,status:'offline'})){
  const listeners=new Set(),runtimeSafety=createNaturalRuntimeSafety();let output,previousNatural=null,lastNaturalAt=null,previousWeather=null;
  return {
    sample(){
      const state=store.getState(),at=now();
      let cycle=state.mode==='automatic'?calculateLightingAtTime(at,state.schedule,state.cycleSettings):null;
      if(state.mode==='natural'){
        const snapshot=environment(),data=snapshot.data?.key===locationKey(state.natural)?snapshot.data:null;
        const seconds=lastNaturalAt===null?0:Math.max(0,(at.getTime()-lastNaturalAt)/1000);
        const weather=smoothWeather(previousWeather,weatherAt(at.getTime(),data,at.getTime(),{current:true}),seconds);previousWeather=weather;
        const target=calculateNaturalLighting(at.getTime(),state.natural,state.safety,data,{now:at.getTime(),current:true,weatherOverride:weather});
        cycle=runtimeSafety(target,previousNatural,at.getTime(),state.natural,state.safety);cycle.weatherStatus=snapshot.status;
        previousNatural=cycle;lastNaturalAt=at.getTime();
      }else{previousNatural=null;lastNaturalAt=null;previousWeather=null;}
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
  return {
    snapshot:()=>{
      const cycle=context?calculateNaturalLighting(epochForZoned(previewDate,time,context.natural.timezone),context.natural,context.safety,context.data,{now:context.now,weatherOverride}):calculateLightingAtTime(time,schedule,settings);
      return {source:'preview',playing,speed,...cycle,minutes:time,date:previewDate};
    },
    setWeatherOverride(name=null){if(!context)throw new Error('Weather simulation requires Natural preview');if(name!==null&&!Object.hasOwn(PREVIEW_WEATHER,name))throw new Error('Invalid preview weather');weatherOverride=name===null?null:PREVIEW_WEATHER[name];},
    resetNow(epoch=Date.now()){if(context){const at=zonedParts(epoch,context.natural.timezone);previewDate=at.date;time=at.minutes;}else time=localMinutes(new Date(epoch));},
    setDate(date){if(!context||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid preview date');previewDate=date;},
    scrub(value){if(!Number.isFinite(value))throw new Error('Invalid preview time');time=((value%1440)+1440)%1440;},
    setPlaying(value){playing=Boolean(value);},
    setSpeed(value){if(![60,360,1440].includes(value))throw new Error('Invalid preview speed');speed=value;},
    advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid preview interval');if(playing)time=(time+seconds*speed/60)%1440;},
  };
}

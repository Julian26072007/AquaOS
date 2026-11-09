import {localMinutes,validateSchedule,calculateLightingAtTime} from './schedule.js';
import {PREVIEW_WEATHER} from './preview-weather.js';
import {getPreset,customPreset} from './presets.js';
import {evaluateEnvironment,evaluateManualLighting} from './environment.js';
import {ease,mixChannels,normalizeChannels} from './lighting.js';
import {createNaturalRuntimeSafety} from './safety.js';
import {locationKey} from './weather.js';
import {createLiveEnvironmentEvaluator} from './live-environment.js';
import {zonedParts,epochForZoned} from './astronomy.js';
/** Only this controller may feed a future hardware subscriber. Its real clock
 * is private and has no setter. Preview has no reference to this controller. */
export function createRealLightingController(store,now=()=>new Date(),environment=()=>({data:null,status:'offline'})){
  const listeners=new Set(),runtimeSafety=createNaturalRuntimeSafety(),evaluateLive=createLiveEnvironmentEvaluator();let output,previousState,selectionTransition,manualStartedAt,previousNatural=null;
  return {
    sample(){
      const state=store.getState(),at=now(),epoch=at.getTime();
      let cycle=state.mode==='automatic'?calculateLightingAtTime(at,state.schedule,state.cycleSettings):null;
      if(state.mode==='natural'){
        const snapshot=environment(),data=snapshot.data?.key===locationKey(state.natural)?snapshot.data:null;
        const target=evaluateLive(epoch,state.natural,state.safety,data);
        cycle=runtimeSafety(target,previousNatural,epoch,state.natural,state.safety);cycle.weatherStatus=snapshot.status;
        previousNatural=cycle;
      }else{previousNatural=null;}
      const preset=cycle?.preset??(state.manualChannels?customPreset:getPreset(state.presetId));
      const selectionChanged=previousState&&(state.mode!==previousState.mode
        ||state.mode==='manual'&&(state.presetId!==previousState.presetId||state.manualChannels!==previousState.manualChannels)
        ||state.mode==='automatic'&&(state.schedule!==previousState.schedule||state.cycleSettings!==previousState.cycleSettings));
      if(selectionChanged)selectionTransition={from:output.channels,at:epoch};
      if(state.mode==='manual'&&(!previousState||selectionChanged))manualStartedAt=epoch;
      let channels=cycle?.channels??state.manualChannels??evaluateManualLighting(preset,epoch,Math.max(0,(epoch-manualStartedAt)/1000));
      if(selectionTransition){
        const progress=ease((epoch-selectionTransition.at)/1500);
        if(progress===1)selectionTransition=null;
        else channels=mixChannels(selectionTransition.from,channels,progress);
      }
      // Natural safety overrides selection fades when darkness or a cap is required.
      if(state.mode==='natural'){
        const cap=cycle.darknessRequired?0:Math.min(state.safety.maxBrightness,cycle.phase==='Moonlight'?state.safety.moonlightCap:1);
        channels=normalizeChannels(Object.fromEntries(Object.entries(channels).map(([key,value])=>[key,Math.min(cap,value)])));
      }
      previousState=state;
      output=Object.freeze({source:'real',at:epoch,mode:state.mode,preset,cycle,channels});
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
  let epoch=context?epochForZoned(previewDate,time,context.natural.timezone):null;
  const updateEpoch=()=>{epoch=epochForZoned(previewDate,time,context.natural.timezone);};
  return {
    get playing(){return playing;},
    snapshot:()=>{
      const cycle=context?evaluateEnvironment(Math.round(epoch),context.natural,context.safety,context.data,{now:context.now,weatherOverride}):calculateLightingAtTime(time,schedule,settings);
      return {source:'preview',playing,speed,at:epoch===null?null:Math.round(epoch),...cycle,minutes:time,date:previewDate};
    },
    setWeatherOverride(name=null){if(!context)throw new Error('Weather simulation requires Natural preview');if(name!==null&&!Object.hasOwn(PREVIEW_WEATHER,name))throw new Error('Invalid preview weather');weatherOverride=name===null?null:PREVIEW_WEATHER[name];},
    resetNow(now=Date.now()){if(context){const at=zonedParts(now,context.natural.timezone);previewDate=at.date;time=at.minutes;epoch=now;}else time=localMinutes(new Date(now));},
    setDate(date){if(!context||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid preview date');previewDate=date;updateEpoch();},
    scrub(value){if(!Number.isFinite(value))throw new Error('Invalid preview time');time=((value%1440)+1440)%1440;if(context)updateEpoch();},
    setPlaying(value){playing=Boolean(value);},
    setSpeed(value){if(![60,360,1440,3600].includes(value))throw new Error('Invalid preview speed');speed=value;},
    advance(seconds){
      if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid preview interval');
      if(playing){
        if(context){epoch+=seconds*speed*1000;const at=zonedParts(Math.round(epoch),context.natural.timezone);previewDate=at.date;time=at.minutes;}
        else time=(time+seconds*speed/60)%1440;
      }
    },
  };
}

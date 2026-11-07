import {getPreset} from './presets.js';
export const DEFAULT_SCHEDULE=Object.freeze({sunriseStart:360,sunriseDuration:180,sunsetStart:1080,sunsetDuration:180});
export const DEFAULT_CYCLE_SETTINGS=Object.freeze({dayBrightness:.8,moonlightEnabled:false,moonlightIntensity:.02});
const wrap=n=>((n%1440)+1440)%1440;
const ease=t=>t*t*(3-2*t);
const mix=(a,b,k)=>a+(b-a)*k;
export function validateSchedule(schedule,settings=DEFAULT_CYCLE_SETTINGS){
  if(!schedule||!settings)throw new Error('Schedule settings are required.');
  for(const key of ['sunriseStart','sunsetStart'])if(!Number.isInteger(schedule[key])||schedule[key]<0||schedule[key]>=1440)throw new Error('Choose valid start times.');
  for(const key of ['sunriseDuration','sunsetDuration'])if(!Number.isInteger(schedule[key])||schedule[key]<1||schedule[key]>720)throw new Error('Durations must be 1–720 minutes.');
  const sunsetOffset=wrap(schedule.sunsetStart-schedule.sunriseStart);
  if(sunsetOffset<=schedule.sunriseDuration||sunsetOffset+schedule.sunsetDuration>=1440)throw new Error('Sunrise, daylight, sunset and night must not overlap. Leave time for every phase.');
  if(!Number.isFinite(settings.dayBrightness)||settings.dayBrightness<0||settings.dayBrightness>1)throw new Error('Day brightness must be 0–100%.');
  if(typeof settings.moonlightEnabled!=='boolean'||!Number.isFinite(settings.moonlightIntensity)||settings.moonlightIntensity<0||settings.moonlightIntensity>.05)throw new Error('Moonlight must be off or at most 5%.');
  return true;
}
export function localMinutes(date){return date.getHours()*60+date.getMinutes()+date.getSeconds()/60+date.getMilliseconds()/60000;}
export function formatTime(minutes){const m=Math.floor(wrap(minutes));return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
/** Pure calculation. No clock, storage, renderer, controller or hardware access. */
export function calculateLightingAtTime(time,schedule=DEFAULT_SCHEDULE,settings=DEFAULT_CYCLE_SETTINGS){
  validateSchedule(schedule,settings);
  const minutes=time instanceof Date?localMinutes(time):time;
  if(!Number.isFinite(minutes))throw new Error('Time must be a valid local time.');
  const offset=wrap(minutes-schedule.sunriseStart),sunset=wrap(schedule.sunsetStart-schedule.sunriseStart);
  let phase,progress=0,next;
  if(offset<schedule.sunriseDuration){phase='Sunrise';progress=ease(offset/schedule.sunriseDuration);next=schedule.sunriseStart+schedule.sunriseDuration;}
  else if(offset<sunset){phase='Daylight';progress=1;next=schedule.sunsetStart;}
  else if(offset<sunset+schedule.sunsetDuration){phase='Sunset';progress=1-ease((offset-sunset)/schedule.sunsetDuration);next=schedule.sunsetStart+schedule.sunsetDuration;}
  else{phase='Night';next=schedule.sunriseStart;}
  const moon=settings.moonlightEnabled?settings.moonlightIntensity:0;
  const brightness=mix(moon,settings.dayBrightness,progress);
  // Warm at dawn/dusk, balanced at full day, with no phase-boundary jumps.
  const day=getPreset('clouds'),night=getPreset('moonlight');
  const emergence=ease(Math.min(1,progress*12));
  const tint=day.lighting.tint.map((v,i)=>mix(night.lighting.tint[i],mix([1,.68,.38][i],v,progress),emergence));
  const preset={
    id:'automatic',name:phase,description:`${phase} · next transition ${formatTime(next)}`,
    top:day.top.map((v,i)=>mix(night.top[i],mix([218,151,98][i],v,progress),emergence)),
    bottom:day.bottom.map((v,i)=>mix(night.bottom[i],v,progress)),
    cloudDensity:day.cloudDensity*progress,
    whiteBalance:mix(.95,.48,progress),rgbGain:mix(.2,1,progress),
    lighting:{ambient:brightness*.44,direct:brightness*.68,tint,caustics:.08*progress},
  };
  return {minutes:wrap(minutes),phase,brightness,progress,nextPhase:({Sunrise:'Daylight',Daylight:'Sunset',Sunset:'Night',Night:'Sunrise'})[phase],nextTransition:wrap(next),preset};
}

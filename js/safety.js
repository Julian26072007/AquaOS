import {OFF,scaleChannels} from './lighting.js';
export const DEFAULT_SAFETY=Object.freeze({maxPhotoperiodHours:9,maxBrightness:.8,minDarkHours:12,minWeatherFactor:.75,maxChangePerMinute:.02,moonlightCap:.002});
export function validateSafety(p){
  const ranges={maxPhotoperiodHours:[1,16],maxBrightness:[0,1],minDarkHours:[8,23],minWeatherFactor:[.5,1],maxChangePerMinute:[.001,.2],moonlightCap:[0,.01]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isFinite(p?.[key])||p[key]<min||p[key]>max)throw new Error(`Invalid safety setting: ${key}`);
  return true;
}
export function safeBudget(config,policy,sunHours=12){
  validateSafety(policy);
  // Seasonal shortening is bounded to one hour; summer never extends the cap.
  const seasonal=Math.min(0,Math.max(-1,(sunHours-12)*config.seasonalStrength));
  const total=Math.max(0,Math.min(config.photoperiodHours+seasonal,policy.maxPhotoperiodHours,24-policy.minDarkHours))*60;
  // Moonlight reserves part of the SAME light budget, never extends it.
  const moon=config.moonEnabled?Math.min(60,total*.15):0;
  return {total,moon,day:total-moon};
}
export function constrainTarget(result,policy){
  const brightness=Math.max(0,Math.min(Number.isFinite(result.brightness)?result.brightness:0,policy.maxBrightness,result.darknessRequired?0:1,result.phase==='Moonlight'?policy.moonlightCap:1));
  const ratio=result.brightness>0?brightness/result.brightness:0;
  return {...result,brightness,channels:scaleChannels(result.channels,ratio)};
}
/** Actual-clock output slew, never called with preview time. Unknown output starts
 * off. Protected darkness and hard ceilings override a soft slew-down limit. */
export function limitRealChange(target,previous,elapsedSeconds,policy){
  const old=Number.isFinite(previous?.brightness)?Math.max(0,previous.brightness):0;
  const limit=policy.maxChangePerMinute*Math.max(0,Math.min(elapsedSeconds,5))/60;
  let brightness=Math.max(old-limit,Math.min(old+limit,target.brightness));
  if(target.darknessRequired)brightness=0;
  brightness=Math.min(brightness,policy.maxBrightness,target.phase==='Moonlight'?policy.moonlightCap:1);
  return {...target,brightness,ramping:Math.abs(brightness-target.brightness)>.001,
    channels:target.brightness>0?scaleChannels(target.channels,brightness/target.brightness):OFF};
}
/** Live episode history prevents a weather/config refresh moving a window from
 * extending an already-running day or reopening a protected dark period. */
export function createNaturalRuntimeSafety(){
  let episodeStart=null,darkUntil=0,lastAt=null;
  function dark(target,reason){return {...target,phase:'Night',brightness:0,darknessRequired:true,policyReason:reason,preset:{...target.preset,name:'Night',description:reason},channels:OFF};}
  return (target,previous,at,config,policy)=>{
    const seconds=lastAt===null?0:Math.max(0,(at-lastAt)/1000);
    if(lastAt!==null&&at<lastAt){darkUntil=Math.max(darkUntil,lastAt+policy.minDarkHours*3600000);target=dark(target,'Clock changed');}
    const maxEpisode=Math.min(config.photoperiodHours,policy.maxPhotoperiodHours,24-policy.minDarkHours)*3600000;
    if(episodeStart!==null&&at-episodeStart>=maxEpisode){target=dark(target,'Light budget reached');}
    if(target.darknessRequired&&episodeStart!==null){darkUntil=Math.max(darkUntil,at+policy.minDarkHours*3600000);episodeStart=null;}
    if(at<darkUntil&&!target.darknessRequired)target=dark(target,'Protected darkness');
    const result=limitRealChange(target,previous,seconds,policy);
    if(result.brightness>0&&episodeStart===null)episodeStart=at;
    lastAt=Math.max(lastAt??at,at);return {...result,safetyState:Object.freeze({episodeStart,darkUntil})};
  };
}
